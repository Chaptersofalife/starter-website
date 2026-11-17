// Prepares photos in the visitor's browser before uploading.
//
// The ORIGINAL file is never changed: it's uploaded exactly as chosen, so the
// full quality is kept for printing. We also make two smaller JPEG copies for
// showing on screen (these are rotated the right way up automatically).

import {
  MAX_PHOTO_BYTES,
  formatBytes,
  photoMime,
  printWarning,
  type PhotoMime,
} from "@/lib/photos";

export type PreparedPhoto = {
  /** The untouched original file. */
  original: File;
  mime: PhotoMime;
  /** Up to 2048 pixels on the longest side, for viewing on screen. */
  display: Blob;
  /** Up to 480 pixels on the longest side, for small previews. */
  thumb: Blob;
  /** A local web address for showing the preview before sending. */
  previewUrl: string;
  width: number;
  height: number;
  /** A gentle "may look soft in print" message, or null. */
  warning: string | null;
};

export class PhotoError extends Error {}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const mime = photoMime(file.name, file.type);
  if (!mime) {
    throw new PhotoError(
      `“${file.name}” isn't a photo we can use. Please choose a JPG, PNG or iPhone (HEIC) photo.`,
    );
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new PhotoError(
      `“${file.name}” is too large (${formatBytes(file.size)}). Photos can be up to ${formatBytes(MAX_PHOTO_BYTES)}.`,
    );
  }

  const bitmap = await decode(file, mime);
  try {
    const width = bitmap.width;
    const height = bitmap.height;
    const display = await resizeToJpeg(bitmap, 2048, 0.88);
    const thumb = await resizeToJpeg(bitmap, 480, 0.8);
    return {
      original: file,
      mime,
      display,
      thumb,
      previewUrl: URL.createObjectURL(thumb),
      width,
      height,
      warning: printWarning(width, height),
    };
  } finally {
    bitmap.close();
  }
}

/** Opens the photo. Uses the HEIC converter only when the browser can't. */
async function decode(file: File, mime: PhotoMime): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if (mime === "image/heic" || mime === "image/heif") {
      try {
        // Loaded only when needed, as it's a large download.
        const { heicTo } = await import("heic-to");
        return await heicTo({ blob: file, type: "bitmap" });
      } catch {
        // fall through to the message below
      }
    }
    throw new PhotoError(
      `We couldn't open “${file.name}”. Please try a different photo, or save it as a JPG first.`,
    );
  }
}

async function resizeToJpeg(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError("Your browser couldn't prepare this photo. Please try another browser.");
  // White behind see-through PNGs, as JPEGs can't be see-through.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  canvas.width = canvas.height = 0; // frees memory on phones
  if (!blob) throw new PhotoError("Your browser couldn't prepare this photo. Please try another browser.");
  return blob;
}

type UploadTarget = { path: string; token: string };
export type PhotoUploadTargets = { original: UploadTarget; display: UploadTarget; thumb: UploadTarget };

/**
 * Uploads the three files for one photo using the one-time upload passes the
 * server gave us. Each pass works for one exact file name only.
 */
export async function uploadPhotoFiles(
  photo: PreparedPhoto,
  targets: PhotoUploadTargets,
): Promise<void> {
  const { createClient } = await import("@/lib/supabase/client");
  const bucket = createClient().storage.from("book-photos");
  const uploads: [UploadTarget, Blob, string][] = [
    [targets.original, photo.original, photo.mime],
    [targets.display, photo.display, "image/jpeg"],
    [targets.thumb, photo.thumb, "image/jpeg"],
  ];
  for (const [target, body, contentType] of uploads) {
    const { error } = await bucket.uploadToSignedUrl(target.path, target.token, body, {
      contentType,
      upsert: false,
    });
    if (error) throw error;
  }
}
