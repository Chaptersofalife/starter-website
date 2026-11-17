"use server";

// What happens when a contributor sends a memory (and photos).
//
// Contributors have no account. Their memory goes through the database's
// submit_memory() "door", which checks the invite link and adds just this one
// memory. For photos, the server then hands out one-time upload passes, each
// for one exact file in the private photo store, and the browser uploads the
// photos directly (phone photos are too big to pass through our server).
// Contributors can't read or change anything else.

import { isBookId } from "@/lib/books";
import { isInviteToken, memoryLimits } from "@/lib/invites";
import {
  CAPTION_MAX,
  MAX_PHOTOS_PER_MEMORY,
  MAX_PHOTO_BYTES,
  TAKEN_MAX,
  allowedMimes,
  type PhotoMime,
} from "@/lib/photos";
import {
  createUploadPasses,
  fileExists,
  newPhotoPaths,
  removeFiles,
} from "@/lib/photos-server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type MemoryFields = {
  contributor_name: string;
  contributor_email: string;
  relationship: string;
  memory: string;
  sayings: string;
};

/** What the browser tells us about each photo (the files themselves go straight to storage). */
export type PhotoInfo = {
  name: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  caption: string;
  taken: string;
};

type UploadTarget = { path: string; token: string };

export type MemoryResult = {
  ok?: boolean;
  memoryId?: string;
  /** One set of upload passes per photo, in the same order they were sent. */
  uploads?: { photoId: string; targets: { original: UploadTarget; display: UploadTarget; thumb: UploadTarget } }[];
  /** True if the book has closed to new memories. */
  closed?: boolean;
  /** True if the memory was saved but photos couldn't be prepared. */
  photosFailed?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof MemoryFields, string>>;
};

/** Forms sent faster than this were almost certainly filled in by a robot. */
const MIN_SECONDS_TO_FILL = 3;

function readFields(formData: FormData): MemoryFields {
  const get = (name: string) => String(formData.get(name) ?? "").trim();
  return {
    contributor_name: get("contributor_name"),
    contributor_email: get("contributor_email"),
    relationship: get("relationship"),
    memory: get("memory"),
    sayings: get("sayings"),
  };
}

function check(values: MemoryFields): MemoryResult["fieldErrors"] {
  const errors: MemoryResult["fieldErrors"] = {};
  const tooLong = (n: number) => `Please keep this to ${n.toLocaleString("en-GB")} characters or fewer.`;

  if (!values.contributor_name) errors.contributor_name = "Please tell us your name.";
  else if (values.contributor_name.length > memoryLimits.contributor_name)
    errors.contributor_name = tooLong(memoryLimits.contributor_name);

  if (!values.contributor_email) errors.contributor_email = "Please enter your email address.";
  else if (
    values.contributor_email.length > memoryLimits.contributor_email ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.contributor_email)
  )
    errors.contributor_email = "Please check your email address is typed correctly.";

  if (!values.relationship) errors.relationship = "Please tell us how you knew them.";
  else if (values.relationship.length > memoryLimits.relationship)
    errors.relationship = tooLong(memoryLimits.relationship);

  if (!values.memory) errors.memory = "Please share a memory before sending.";
  else if (values.memory.length > memoryLimits.memory)
    errors.memory = tooLong(memoryLimits.memory);

  if (values.sayings.length > memoryLimits.sayings) errors.sayings = tooLong(memoryLimits.sayings);

  return errors;
}

/** Reads and checks the photo details sent by the browser. Returns null if anything is off. */
function readPhotos(formData: FormData): PhotoInfo[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("photos") ?? "[]"));
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || raw.length > MAX_PHOTOS_PER_MEMORY) return null;
  const photos: PhotoInfo[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") return null;
    const photo = {
      name: String(p.name ?? "").slice(0, 200),
      mime: String(p.mime ?? ""),
      size: Number(p.size),
      width: Math.round(Number(p.width)) || 0,
      height: Math.round(Number(p.height)) || 0,
      caption: String(p.caption ?? "").trim(),
      taken: String(p.taken ?? "").trim(),
    };
    if (
      !(allowedMimes as string[]).includes(photo.mime) ||
      !(photo.size > 0 && photo.size <= MAX_PHOTO_BYTES) ||
      photo.caption.length > CAPTION_MAX ||
      photo.taken.length > TAKEN_MAX
    ) {
      return null;
    }
    photos.push(photo);
  }
  return photos;
}

// ---------------------------------------------------------------------------

export async function submitMemory(token: string, formData: FormData): Promise<MemoryResult> {
  // Spam protection 1: a hidden box people never see. Robots fill it in.
  // We pretend it worked, so the robot learns nothing.
  if (String(formData.get("website") ?? "") !== "") {
    return { ok: true, uploads: [] };
  }

  // Spam protection 2: robots send forms instantly; people take a few seconds.
  const startedAt = Number(formData.get("started_at"));
  if (startedAt && Date.now() - startedAt < MIN_SECONDS_TO_FILL * 1000) {
    return { ok: true, uploads: [] };
  }

  const values = readFields(formData);
  const fieldErrors = check(values);
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, error: "Please check the highlighted answers." };
  }
  if (!isInviteToken(token)) {
    return { error: linkNotWorking };
  }

  const photos = readPhotos(formData);
  if (!photos) {
    return { error: "Something wasn't right with the photos. Please remove them and add them again." };
  }
  const admin = getAdminClient();
  if (photos.length > 0 && !admin) {
    return {
      error:
        "Photos can't be added just now. You can remove the photos and send your memory on its own, or try again later.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_memory", {
    invite: token,
    contributor_name: values.contributor_name,
    contributor_email: values.contributor_email,
    relationship: values.relationship,
    memory: values.memory,
    sayings: values.sayings || null,
  });

  if (error) {
    // Spam protection 3: the database limits how fast memories can arrive.
    switch (error.message) {
      case "invite_not_found":
        return { error: linkNotWorking };
      case "book_closed":
        // Checked by the database, so it can't be got round.
        return { closed: true, error: bookClosed };
      case "too_many_memories":
        return {
          error:
            "Lots of memories have arrived in the last few minutes. Please wait ten minutes and try again. Your words are still here.",
        };
      case "book_full":
        return { error: "This book can't take any more memories. Please contact the person who invited you." };
      case "invalid_memory":
        return { error: "Please check your answers and try again." };
      default:
        console.error("Submit memory failed:", error.code, error.message);
        return {
          error:
            "Sorry, your memory couldn't be sent just now. Please check your connection and try again. Your words are still here.",
        };
    }
  }

  const saved = (data as { memory_id: string; book_id: string }[] | null)?.[0];
  if (!saved) {
    return { error: "Sorry, your memory couldn't be sent just now. Please try again." };
  }
  if (photos.length === 0 || !admin) {
    return { ok: true, memoryId: saved.memory_id, uploads: [] };
  }

  // Prepare a private place and one-time upload passes for each photo.
  try {
    const uploads: NonNullable<MemoryResult["uploads"]> = [];
    const folder = `${saved.book_id}/memories/${saved.memory_id}`;
    for (const [position, photo] of photos.entries()) {
      const paths = newPhotoPaths(folder, photo.mime as PhotoMime);
      const { data: row, error: insertError } = await admin
        .from("memory_photos")
        .insert({
          memory_id: saved.memory_id,
          book_id: saved.book_id,
          position,
          original_path: paths.original,
          display_path: paths.display,
          thumb_path: paths.thumb,
          original_name: photo.name || null,
          mime_type: photo.mime,
          size_bytes: photo.size,
          width: photo.width || null,
          height: photo.height || null,
          caption: photo.caption || null,
          taken_text: photo.taken || null,
        })
        .select("id")
        .single();
      if (insertError || !row) throw insertError ?? new Error("photo_row_failed");
      uploads.push({ photoId: row.id, targets: await createUploadPasses(paths) });
    }
    return { ok: true, memoryId: saved.memory_id, uploads };
  } catch (e) {
    console.error("Preparing photo uploads failed:", e);
    return { ok: true, memoryId: saved.memory_id, uploads: [], photosFailed: true };
  }
}

/**
 * Called after the browser has uploaded the photos. Marks each photo as
 * received once all three of its files are really there.
 */
export async function finishMemoryPhotos(
  token: string,
  memoryId: string,
  photoIds: string[],
): Promise<{ received: number }> {
  const admin = getAdminClient();
  if (!admin || !isInviteToken(token) || !isBookId(memoryId)) return { received: 0 };
  const ids = photoIds.filter(isBookId).slice(0, MAX_PHOTOS_PER_MEMORY);
  if (ids.length === 0) return { received: 0 };

  // Check this memory really belongs to the book with this invite link.
  const { data: memory } = await admin
    .from("memories")
    .select("id, books!inner(invite_token)")
    .eq("id", memoryId)
    .eq("books.invite_token", token)
    .maybeSingle();
  if (!memory) return { received: 0 };

  const { data: photos } = await admin
    .from("memory_photos")
    .select("id, original_path, display_path, thumb_path")
    .eq("memory_id", memoryId)
    .in("id", ids);

  let received = 0;
  for (const photo of photos ?? []) {
    const allThere =
      (await fileExists(photo.original_path)) &&
      (await fileExists(photo.display_path)) &&
      (await fileExists(photo.thumb_path));
    if (allThere) {
      await admin.from("memory_photos").update({ uploaded: true }).eq("id", photo.id);
      received++;
    }
  }
  return { received };
}

/** Tidies up a photo whose upload failed, so no half-sent files are left behind. */
export async function abandonMemoryPhoto(token: string, memoryId: string, photoId: string) {
  const admin = getAdminClient();
  if (!admin || !isInviteToken(token) || !isBookId(memoryId) || !isBookId(photoId)) return;
  const { data: memory } = await admin
    .from("memories")
    .select("id, books!inner(invite_token)")
    .eq("id", memoryId)
    .eq("books.invite_token", token)
    .maybeSingle();
  if (!memory) return;
  const { data: photo } = await admin
    .from("memory_photos")
    .select("id, original_path, display_path, thumb_path, uploaded")
    .eq("id", photoId)
    .eq("memory_id", memoryId)
    .maybeSingle();
  if (!photo || photo.uploaded) return;
  await removeFiles([photo.original_path, photo.display_path, photo.thumb_path]);
  await admin.from("memory_photos").delete().eq("id", photo.id);
}

const linkNotWorking =
  "This link is no longer working. Please ask the person who invited you for a new one.";

const bookClosed =
  "This book is now closed to new memories. Thank you for being part of it.";
