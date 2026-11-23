"use server";

// What happens when an organiser saves, changes or deletes a book.
// These run on the server. Supabase's Row Level Security also checks every
// request, so an organiser can only ever touch their own books.

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  earliestDate,
  isBookId,
  isValidDate,
  limits,
  todayInUK,
} from "@/lib/books";
import { MAX_PHOTO_BYTES, allowedMimes, mimeToExtension, type PhotoMime } from "@/lib/photos";
import {
  createUploadPasses,
  fileExists,
  newPhotoPaths,
  removeFiles,
  signedDownloadUrl,
} from "@/lib/photos-server";
import { isBookStyleId } from "@/lib/book-styles";
import { closingDateProblem } from "@/lib/closing";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type BookFields = {
  full_name: string;
  known_as: string;
  date_of_birth: string;
  date_of_death: string;
  lived_in: string;
  introduction: string;
  closes_on: string;
};

export type BookFormState = {
  /** A problem with the whole form, in plain words. */
  error?: string;
  /** A problem with one answer, shown next to it. */
  fieldErrors?: Partial<Record<keyof BookFields, string>>;
  /** What the organiser typed, so nothing is lost if there's a problem. */
  values?: BookFields;
};

function readFields(formData: FormData): BookFields {
  const get = (name: string) => String(formData.get(name) ?? "").trim();
  return {
    full_name: get("full_name"),
    known_as: get("known_as"),
    date_of_birth: get("date_of_birth"),
    date_of_death: get("date_of_death"),
    lived_in: get("lived_in"),
    introduction: get("introduction"),
    closes_on: get("closes_on"),
  };
}

function check(values: BookFields, originalClosesOn = ""): BookFormState["fieldErrors"] {
  const errors: BookFormState["fieldErrors"] = {};
  const today = todayInUK();

  if (!values.full_name) {
    errors.full_name = "Please enter their full name.";
  } else if (values.full_name.length > limits.full_name) {
    errors.full_name = `Please keep this to ${limits.full_name} characters or fewer.`;
  }
  if (values.known_as.length > limits.known_as) {
    errors.known_as = `Please keep this to ${limits.known_as} characters or fewer.`;
  }
  if (values.lived_in.length > limits.lived_in) {
    errors.lived_in = `Please keep this to ${limits.lived_in} characters or fewer.`;
  }
  if (values.introduction.length > limits.introduction) {
    errors.introduction = `Please keep the introduction to ${limits.introduction} characters or fewer.`;
  }

  if (!values.date_of_birth) {
    errors.date_of_birth = "Please enter their date of birth.";
  } else if (!isValidDate(values.date_of_birth) || values.date_of_birth < earliestDate) {
    errors.date_of_birth = "Please check the date of birth.";
  } else if (values.date_of_birth > today) {
    errors.date_of_birth = "The date of birth can't be in the future.";
  }

  if (!values.date_of_death) {
    errors.date_of_death = "Please enter the date they died.";
  } else if (!isValidDate(values.date_of_death) || values.date_of_death < earliestDate) {
    errors.date_of_death = "Please check the date they died.";
  } else if (values.date_of_death > today) {
    errors.date_of_death = "This date can't be in the future.";
  } else if (
    !errors.date_of_birth &&
    values.date_of_death < values.date_of_birth
  ) {
    errors.date_of_death = "This date is before their date of birth. Please check both dates.";
  }

  const closingProblem = closingDateProblem(
    values.closes_on,
    values.closes_on !== "" && values.closes_on === originalClosesOn,
  );
  if (closingProblem) errors.closes_on = closingProblem;

  return errors;
}

/** Empty optional answers are saved as "nothing", not as blank text. */
function toRow(values: BookFields) {
  return {
    full_name: values.full_name,
    known_as: values.known_as || null,
    date_of_birth: values.date_of_birth,
    date_of_death: values.date_of_death,
    lived_in: values.lived_in || null,
    introduction: values.introduction || null,
    closes_on: values.closes_on || null,
  };
}

async function signedInClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/login");
  }
  return supabase;
}

const problemSaving =
  "Sorry, we couldn't save the book just now. Please check your connection and try again.";

// ---------------------------------------------------------------------------

export async function createBook(_prev: BookFormState, formData: FormData): Promise<BookFormState> {
  const values = readFields(formData);
  const fieldErrors = check(values);
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    return { values, fieldErrors, error: "Please check the highlighted answers." };
  }

  const supabase = await signedInClient();
  // organiser_id is filled in by the database from the signed-in organiser.
  const { error } = await supabase.from("books").insert(toRow(values));
  if (error) {
    console.error("Create book failed:", error.code, error.message);
    return { values, error: problemSaving };
  }

  revalidatePath("/my-books");
  redirect("/my-books?status=created");
}

export async function updateBook(
  bookId: string,
  _prev: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const values = readFields(formData);
  // An existing closing date that has passed can be kept while editing other details.
  const fieldErrors = check(values, String(formData.get("original_closes_on") ?? ""));
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    return { values, fieldErrors, error: "Please check the highlighted answers." };
  }
  if (!isBookId(bookId)) {
    return { values, error: "We couldn't find this book." };
  }

  const supabase = await signedInClient();
  const { data, error } = await supabase
    .from("books")
    .update(toRow(values))
    .eq("id", bookId)
    .select("id");

  if (error) {
    console.error("Update book failed:", error.code, error.message);
    return { values, error: problemSaving };
  }
  if (!data || data.length === 0) {
    // Not their book (or it no longer exists). Row Level Security blocked it.
    return { values, error: "We couldn't find this book. It may have been deleted." };
  }

  revalidatePath("/my-books");
  redirect(`/my-books/${bookId}?status=saved`);
}

/**
 * Makes a new private invite link for a book. The old link stops working
 * straight away, because the old code no longer matches any book.
 */
export async function createNewInviteLink(bookId: string) {
  if (!isBookId(bookId)) {
    redirect("/my-books");
  }

  // 64 random characters (256 bits) from the server's secure random
  // generator. Practically impossible to guess.
  const token = randomBytes(32).toString("hex");

  const supabase = await signedInClient();
  const { data, error } = await supabase
    .from("books")
    .update({ invite_token: token })
    .eq("id", bookId)
    .select("id");

  if (error || !data || data.length === 0) {
    if (error) console.error("New invite link failed:", error.code, error.message);
    redirect(`/my-books/${bookId}?status=link-failed#invite`);
  }

  redirect(`/my-books/${bookId}?status=new-link#invite`);
}

export async function deleteBook(bookId: string) {
  if (!isBookId(bookId)) {
    redirect("/my-books");
  }

  const supabase = await signedInClient();

  // Note the photo files first (Row Level Security only shows this organiser's).
  const [{ data: book }, { data: photos }] = await Promise.all([
    supabase
      .from("books")
      .select("cover_original_path, cover_display_path, cover_thumb_path")
      .eq("id", bookId)
      .maybeSingle(),
    supabase
      .from("memory_photos")
      .select("original_path, display_path, thumb_path")
      .eq("book_id", bookId),
  ]);

  const { error } = await supabase.from("books").delete().eq("id", bookId);
  if (error) {
    console.error("Delete book failed:", error.code, error.message);
    redirect(`/my-books/${bookId}?status=delete-failed`);
  }

  // Then delete the photo files from the private photo store.
  if (book) {
    await removeFiles([
      book.cover_original_path,
      book.cover_display_path,
      book.cover_thumb_path,
      ...(photos ?? []).flatMap((p) => [p.original_path, p.display_path, p.thumb_path]),
    ]);
  }

  revalidatePath("/my-books");
  redirect("/my-books?status=deleted");
}

// ---------------------------------------------------------------------------
// Cover photo
// ---------------------------------------------------------------------------

type UploadTarget = { path: string; token: string };
export type CoverUpload =
  | { ok: true; targets: { original: UploadTarget; display: UploadTarget; thumb: UploadTarget } }
  | { ok: false; error: string };

const coverProblem = "Sorry, the photo couldn't be saved just now. Please try again.";

/** True if the signed-in organiser owns this book (checked by Row Level Security). */
async function ownsBook(supabase: Awaited<ReturnType<typeof signedInClient>>, bookId: string) {
  // Also false once the book is approved for printing (locked).
  const { data } = await supabase.from("books").select("id, locked_at").eq("id", bookId).maybeSingle();
  return Boolean(data && !data.locked_at);
}

/** Step 1: one-time upload passes for a new cover photo. */
export async function prepareCoverUpload(
  bookId: string,
  info: { mime: string; size: number },
): Promise<CoverUpload> {
  if (!isBookId(bookId)) return { ok: false, error: coverProblem };
  if (!(allowedMimes as string[]).includes(info.mime) || !(info.size > 0 && info.size <= MAX_PHOTO_BYTES)) {
    return { ok: false, error: "Please choose a JPG, PNG or iPhone (HEIC) photo up to 50 MB." };
  }
  if (!getAdminClient()) {
    return { ok: false, error: "Photos can't be added just now. Please try again later." };
  }
  const supabase = await signedInClient();
  if (!(await ownsBook(supabase, bookId))) return { ok: false, error: coverProblem };

  try {
    const paths = newPhotoPaths(`${bookId}/cover`, info.mime as PhotoMime);
    return { ok: true, targets: await createUploadPasses(paths) };
  } catch (e) {
    console.error("Preparing cover upload failed:", e);
    return { ok: false, error: coverProblem };
  }
}

/** Step 2: after uploading, use the new photo as the cover (and delete the old one). */
export async function saveCover(
  bookId: string,
  paths: { original: string; display: string; thumb: string },
  size: { width: number; height: number },
): Promise<{ ok: boolean; error?: string }> {
  if (!isBookId(bookId)) return { ok: false, error: coverProblem };

  // The files must be in this book's cover folder, all for the same photo.
  const folder = paths.original.slice(0, paths.original.lastIndexOf("/"));
  const ext = paths.original.split(".").pop() ?? "";
  const valid =
    /^[0-9a-f-]{36}\/cover\/[0-9a-f-]{36}$/.test(folder) &&
    folder.startsWith(`${bookId}/cover/`) &&
    Object.values(mimeToExtension).includes(ext) &&
    paths.display === `${folder}/display.jpg` &&
    paths.thumb === `${folder}/thumb.jpg`;
  if (!valid) return { ok: false, error: coverProblem };

  const supabase = await signedInClient();
  const { data: book } = await supabase
    .from("books")
    .select("cover_original_path, cover_display_path, cover_thumb_path")
    .is("locked_at", null) // not once approved for printing
    .eq("id", bookId)
    .maybeSingle();
  if (!book) return { ok: false, error: coverProblem };

  const arrived =
    (await fileExists(paths.original)) &&
    (await fileExists(paths.display)) &&
    (await fileExists(paths.thumb));
  if (!arrived) {
    return { ok: false, error: "The photo didn't finish uploading. Please check your connection and try again." };
  }

  const { error } = await supabase
    .from("books")
    .update({
      cover_original_path: paths.original,
      cover_display_path: paths.display,
      cover_thumb_path: paths.thumb,
      cover_width: Math.round(size.width) || null,
      cover_height: Math.round(size.height) || null,
    })
    .eq("id", bookId);
  if (error) {
    console.error("Save cover failed:", error.code, error.message);
    await removeFiles([paths.original, paths.display, paths.thumb]);
    return { ok: false, error: coverProblem };
  }

  await removeFiles([book.cover_original_path, book.cover_display_path, book.cover_thumb_path]);
  revalidatePath(`/my-books/${bookId}`);
  return { ok: true };
}

/** Removes the cover photo (and deletes its files). */
export async function removeCover(bookId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isBookId(bookId)) return { ok: false, error: coverProblem };
  const supabase = await signedInClient();
  const { data: book } = await supabase
    .from("books")
    .select("cover_original_path, cover_display_path, cover_thumb_path")
    .is("locked_at", null) // not once approved for printing
    .eq("id", bookId)
    .maybeSingle();
  if (!book) return { ok: false, error: coverProblem };

  const { error } = await supabase
    .from("books")
    .update({
      cover_original_path: null,
      cover_display_path: null,
      cover_thumb_path: null,
      cover_width: null,
      cover_height: null,
    })
    .eq("id", bookId);
  if (error) {
    console.error("Remove cover failed:", error.code, error.message);
    return { ok: false, error: "Sorry, the photo couldn't be removed just now. Please try again." };
  }

  await removeFiles([book.cover_original_path, book.cover_display_path, book.cover_thumb_path]);
  revalidatePath(`/my-books/${bookId}`);
  return { ok: true };
}

/** Throws away a cover upload that didn't finish. */
export async function abandonCoverUpload(bookId: string, paths: { original: string; display: string; thumb: string }) {
  if (!isBookId(bookId)) return;
  const supabase = await signedInClient();
  if (!(await ownsBook(supabase, bookId))) return;
  const inFolder = (p: string) => p.startsWith(`${bookId}/cover/`);
  if (![paths.original, paths.display, paths.thumb].every(inFolder)) return;
  // Never delete the photo that's currently the cover.
  const { data: book } = await supabase.from("books").select("cover_original_path").eq("id", bookId).maybeSingle();
  if (book?.cover_original_path === paths.original) return;
  await removeFiles([paths.original, paths.display, paths.thumb]);
}

// ---------------------------------------------------------------------------
// Downloading originals
// ---------------------------------------------------------------------------

/**
 * A one-hour link to download a contributor's original, full-quality photo.
 * Row Level Security makes sure it's a photo in one of this organiser's books.
 */
export async function getOriginalDownloadUrl(photoId: string): Promise<string | null> {
  if (!isBookId(photoId)) return null;
  const supabase = await signedInClient();
  const { data: photo } = await supabase
    .from("memory_photos")
    .select("original_path, original_name, mime_type, position, memories(contributor_name)")
    .eq("id", photoId)
    .eq("uploaded", true)
    .maybeSingle<{
      original_path: string;
      original_name: string | null;
      mime_type: PhotoMime;
      position: number;
      memories: { contributor_name: string } | null;
    }>();
  if (!photo) return null;

  const ext = mimeToExtension[photo.mime_type] ?? "jpg";
  const contributor = (photo.memories?.contributor_name ?? "photo")
    .replace(/[^A-Za-z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40) || "photo";
  const fileName = photo.original_name?.trim() || `${contributor}-${photo.position + 1}.${ext}`;
  return signedDownloadUrl(photo.original_path, fileName);
}

// ---------------------------------------------------------------------------
// Closing date: change it, close early, or reopen
// ---------------------------------------------------------------------------

export type ClosingResult = { ok: boolean; error?: string };

async function updateClosing(bookId: string, changes: { closes_on?: string | null; closed_at?: string | null }): Promise<ClosingResult> {
  if (!isBookId(bookId)) return { ok: false, error: "We couldn't find this book." };
  const supabase = await signedInClient();
  const { data, error } = await supabase.from("books").update(changes).eq("id", bookId).select("id");
  if (error) {
    console.error("Closing date update failed:", error.code, error.message);
    return { ok: false, error: "Sorry, that didn't save. Please try again." };
  }
  if (!data || data.length === 0) return { ok: false, error: "We couldn't find this book." };
  revalidatePath(`/my-books/${bookId}`);
  revalidatePath("/my-books");
  return { ok: true };
}

/** Sets (or removes, with "") the closing date. Also reopens a book that was closed early. */
export async function setClosingDate(bookId: string, closesOn: string): Promise<ClosingResult> {
  const problem = closingDateProblem(closesOn);
  if (problem) return { ok: false, error: problem };
  return updateClosing(bookId, { closes_on: closesOn || null, closed_at: null });
}

/** Stops new memories straight away. The closing date is kept, for reference. */
export async function closeBookNow(bookId: string): Promise<ClosingResult> {
  return updateClosing(bookId, { closed_at: new Date().toISOString() });
}

/** Opens the book again, until a new closing date (or with no date, if blank). */
export async function reopenBook(bookId: string, closesOn: string): Promise<ClosingResult> {
  const problem = closingDateProblem(closesOn);
  if (problem) return { ok: false, error: problem };
  return updateClosing(bookId, { closes_on: closesOn || null, closed_at: null });
}

// ---------------------------------------------------------------------------
// Book style (cover colours)
// ---------------------------------------------------------------------------

/** Saves the book's style. Row Level Security refuses it once the book is locked. */
export async function setBookStyle(bookId: string, styleId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isBookId(bookId) || !isBookStyleId(styleId)) return { ok: false, error: "Please choose one of the styles." };
  const supabase = await signedInClient();
  const { data, error } = await supabase.from("books").update({ book_style: styleId }).eq("id", bookId).select("id");
  if (error) {
    console.error("Saving book style failed:", error.code, error.message);
    return { ok: false, error: "Sorry, that didn't save. Please try again." };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "The style can't be changed now the book is approved for printing." };
  }
  revalidatePath(`/my-books/${bookId}`);
  return { ok: true };
}
