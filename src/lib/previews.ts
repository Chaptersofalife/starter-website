// Preview PDFs (server only). They live in the private "book-previews" bucket.
// Always check who is asking (the order's organiser, or an admin) first.
import "server-only";
import { randomUUID } from "node:crypto";
import { PREVIEW_BUCKET } from "@/lib/orders";
import { getAdminClient } from "@/lib/supabase/admin";

/** A new, unguessable file name, e.g. "<order id>/v2-<random>.pdf". */
export function newPreviewPath(orderId: string, version: number) {
  return `${orderId}/v${version}-${randomUUID()}.pdf`;
}

/** A one-time pass to upload one preview PDF (valid for 2 hours). */
export async function previewUploadPass(path: string) {
  const admin = getAdminClient();
  if (!admin) throw new Error("photos_not_configured");
  const { data, error } = await admin.storage.from(PREVIEW_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("upload_pass_failed");
  return { path: data.path, token: data.token };
}

/** A one-hour link to view (or, with a file name, download) a preview. */
export async function signedPreviewUrl(path: string, downloadName?: string) {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.storage
    .from(PREVIEW_BUCKET)
    .createSignedUrl(path, 60 * 60, downloadName ? { download: downloadName } : undefined);
  return error ? null : data.signedUrl;
}

/** True if a preview file has finished uploading. */
export async function previewExists(path: string) {
  const admin = getAdminClient();
  if (!admin) return false;
  const slash = path.lastIndexOf("/");
  const { data, error } = await admin.storage
    .from(PREVIEW_BUCKET)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
  return !error && (data ?? []).some((f) => f.name === path.slice(slash + 1));
}

/**
 * Locks a book once its preview is approved: it closes to new memories, and
 * the database stops the organiser changing anything (see the migration).
 */
export async function lockBookForPrint(bookId: string) {
  const admin = getAdminClient();
  if (!admin) return;
  const now = new Date().toISOString();
  await admin.from("books").update({ locked_at: now }).eq("id", bookId).is("locked_at", null);
  await admin.from("books").update({ closed_at: now }).eq("id", bookId).is("closed_at", null);
}
