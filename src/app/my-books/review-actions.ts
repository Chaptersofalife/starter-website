"use server";

// What happens when an organiser reviews memories on a book's page.
// Every change goes through the organiser's own sign-in, so Supabase's Row
// Level Security checks it's a memory in one of their books. The
// contributor's original words are never changed.

import { revalidatePath } from "next/cache";
import { isBookId } from "@/lib/books";
import { memoryLimits } from "@/lib/invites";
import { removeFiles } from "@/lib/photos-server";
import { createClient } from "@/lib/supabase/server";

export type MemoryStatus = "waiting" | "approved" | "hidden";
export type ReviewResult = { ok: boolean; error?: string };

const statuses: MemoryStatus[] = ["waiting", "approved", "hidden"];
const notFound = "We couldn't find this memory. Please refresh the page.";
const tryAgain = "Sorry, that didn't save. Please check your connection and try again.";

async function signedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

/** Updates one memory, and reports whether Row Level Security allowed it. */
async function updateMemory(memoryId: string, changes: Record<string, unknown>): Promise<ReviewResult> {
  if (!isBookId(memoryId)) return { ok: false, error: notFound };
  const supabase = await signedIn();
  if (!supabase) return { ok: false, error: "Please log in again." };

  const { data, error } = await supabase
    .from("memories")
    .update(changes)
    .eq("id", memoryId)
    .select("book_id");
  if (error) {
    console.error("Review update failed:", error.code, error.message);
    return { ok: false, error: tryAgain };
  }
  if (!data || data.length === 0) return { ok: false, error: notFound };
  revalidatePath(`/my-books/${data[0].book_id}`);
  return { ok: true };
}

/** Approve (goes in the book), hide (kept, but not in the book), or back to waiting. */
export async function setMemoryStatus(memoryId: string, status: MemoryStatus): Promise<ReviewResult> {
  if (!statuses.includes(status)) return { ok: false, error: tryAgain };
  return updateMemory(memoryId, { status });
}

/** Saves the organiser's corrected version. The contributor's original is kept. */
export async function saveMemoryEdit(
  memoryId: string,
  text: { memory: string; sayings: string },
  original: { memory: string; sayings: string | null },
): Promise<ReviewResult> {
  const memory = text.memory.trim();
  const sayings = text.sayings.trim();
  if (!memory) return { ok: false, error: "The memory can't be empty. To leave it out of the book, choose Hide instead." };
  if (memory.length > memoryLimits.memory)
    return { ok: false, error: `Please keep the memory to ${memoryLimits.memory.toLocaleString("en-GB")} characters or fewer.` };
  if (sayings.length > memoryLimits.sayings)
    return { ok: false, error: `Please keep the sayings to ${memoryLimits.sayings.toLocaleString("en-GB")} characters or fewer.` };

  // Only store an edit where it differs from what the contributor wrote.
  const editedMemory = memory === original.memory.trim() ? null : memory;
  const editedSayings = sayings === (original.sayings ?? "").trim() ? null : sayings;
  return updateMemory(memoryId, {
    edited_memory: editedMemory,
    edited_sayings: editedSayings,
    edited_at: editedMemory !== null || editedSayings !== null ? new Date().toISOString() : null,
  });
}

/** Goes back to exactly what the contributor wrote. */
export async function undoMemoryEdit(memoryId: string): Promise<ReviewResult> {
  return updateMemory(memoryId, { edited_memory: null, edited_sayings: null, edited_at: null });
}

/** Hides one photo from the book (or shows it again). The photo is kept. */
export async function setPhotoHidden(photoId: string, hidden: boolean): Promise<ReviewResult> {
  if (!isBookId(photoId)) return { ok: false, error: notFound };
  const supabase = await signedIn();
  if (!supabase) return { ok: false, error: "Please log in again." };

  const { data, error } = await supabase
    .from("memory_photos")
    .update({ hidden: Boolean(hidden) })
    .eq("id", photoId)
    .select("book_id");
  if (error) {
    console.error("Hide photo failed:", error.code, error.message);
    return { ok: false, error: tryAgain };
  }
  if (!data || data.length === 0) return { ok: false, error: "We couldn't find this photo. Please refresh the page." };
  revalidatePath(`/my-books/${data[0].book_id}`);
  return { ok: true };
}

/** Deletes a memory and its photos completely. */
export async function deleteMemory(memoryId: string): Promise<ReviewResult> {
  if (!isBookId(memoryId)) return { ok: false, error: notFound };
  const supabase = await signedIn();
  if (!supabase) return { ok: false, error: "Please log in again." };

  // Note its photo files first (Row Level Security only shows this organiser's).
  const { data: photos } = await supabase
    .from("memory_photos")
    .select("original_path, display_path, thumb_path")
    .eq("memory_id", memoryId);

  const { data, error } = await supabase.from("memories").delete().eq("id", memoryId).select("book_id");
  if (error) {
    console.error("Delete memory failed:", error.code, error.message);
    return { ok: false, error: "Sorry, the memory couldn't be deleted just now. Please try again." };
  }
  if (!data || data.length === 0) return { ok: false, error: notFound };

  await removeFiles((photos ?? []).flatMap((p) => [p.original_path, p.display_path, p.thumb_path]));
  revalidatePath(`/my-books/${data[0].book_id}`);
  return { ok: true };
}

/** Stars (or un-stars) a memory as one the organiser most wants included. */
export async function setFavourite(memoryId: string, favourite: boolean): Promise<ReviewResult> {
  return updateMemory(memoryId, { favourite: Boolean(favourite) });
}
