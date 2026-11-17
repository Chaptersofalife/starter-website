// Photo helpers that run on the server only (they use the secret key).
// Always check who is asking BEFORE calling these.
import "server-only";
import { randomUUID } from "node:crypto";
import { PHOTO_BUCKET, getAdminClient } from "@/lib/supabase/admin";
import { mimeToExtension, type PhotoMime } from "@/lib/photos";

/** How long viewing links last. */
const VIEW_LINK_SECONDS = 60 * 60; // 1 hour

export type PhotoPaths = { original: string; display: string; thumb: string };

/**
 * New, unguessable file names for one photo, e.g.
 *   <book id>/memories/<memory id>/<random>/original.heic
 */
export function newPhotoPaths(folder: string, mime: PhotoMime): PhotoPaths {
  const base = `${folder}/${randomUUID()}`;
  return {
    original: `${base}/original.${mimeToExtension[mime]}`,
    display: `${base}/display.jpg`,
    thumb: `${base}/thumb.jpg`,
  };
}

/** One-time upload passes for one photo's three files (valid for 2 hours). */
export async function createUploadPasses(paths: PhotoPaths) {
  const admin = getAdminClient();
  if (!admin) throw new Error("photos_not_configured");
  const bucket = admin.storage.from(PHOTO_BUCKET);
  const pass = async (path: string) => {
    const { data, error } = await bucket.createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("upload_pass_failed");
    return { path: data.path, token: data.token };
  };
  return {
    original: await pass(paths.original),
    display: await pass(paths.display),
    thumb: await pass(paths.thumb),
  };
}

/** Viewing links (1 hour) for many files at once, keyed by path. */
export async function signedViewUrls(paths: (string | null | undefined)[]) {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const result = new Map<string, string>();
  const admin = getAdminClient();
  if (!admin || wanted.length === 0) return result;
  const { data, error } = await admin.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(wanted, VIEW_LINK_SECONDS);
  if (error) {
    console.error("Signing photo links failed:", error.message);
    return result;
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) result.set(item.path, item.signedUrl);
  }
  return result;
}

/** A download link (1 hour) that saves the original file with a friendly name. */
export async function signedDownloadUrl(path: string, fileName: string) {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, VIEW_LINK_SECONDS, { download: fileName });
  if (error) return null;
  return data.signedUrl;
}

/** True if a file has finished uploading. */
export async function fileExists(path: string) {
  const admin = getAdminClient();
  if (!admin) return false;
  const slash = path.lastIndexOf("/");
  const { data, error } = await admin.storage
    .from(PHOTO_BUCKET)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
  return !error && (data ?? []).some((f) => f.name === path.slice(slash + 1));
}

/** Deletes files from storage (ignores ones that are already gone). */
export async function removeFiles(paths: (string | null | undefined)[]) {
  const admin = getAdminClient();
  const wanted = paths.filter((p): p is string => Boolean(p));
  if (!admin || wanted.length === 0) return;
  for (let i = 0; i < wanted.length; i += 100) {
    const { error } = await admin.storage.from(PHOTO_BUCKET).remove(wanted.slice(i, i + 100));
    if (error) console.error("Removing photos failed:", error.message);
  }
}
