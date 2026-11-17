// Shared rules for photos, used by both the browser and the server.

/** Most photos one contributor can add to one memory. */
export const MAX_PHOTOS_PER_MEMORY = 10;

/** Largest file accepted (Supabase's free plan allows up to 50 MB per file). */
export const MAX_PHOTO_BYTES = 50 * 1024 * 1024;

export const CAPTION_MAX = 300;
export const TAKEN_MAX = 60;

/**
 * Below this many pixels on the shorter side, a photo may look soft in print.
 * 1,200 pixels prints sharply at about 4 × 6 inches (300 dots per inch).
 */
export const PRINT_MIN_SHORT_SIDE = 1200;

export type PhotoMime = "image/jpeg" | "image/png" | "image/heic" | "image/heif";

const extensionToMime: Record<string, PhotoMime> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
};

export const mimeToExtension: Record<PhotoMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
};

export const allowedMimes = Object.keys(mimeToExtension) as PhotoMime[];

/** For the file picker: what kinds of file to offer. */
export const acceptAttribute = "image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif";

/**
 * Works out the file type. Some browsers don't label iPhone (HEIC) photos,
 * so we also look at the end of the file name.
 */
export function photoMime(name: string, type: string): PhotoMime | null {
  const lowerType = type.toLowerCase();
  if ((allowedMimes as string[]).includes(lowerType)) return lowerType as PhotoMime;
  if (lowerType === "image/jpg" || lowerType === "image/pjpeg") return "image/jpeg";
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return extensionToMime[ext] ?? null;
}

/** A gentle message if a photo may be too small to print well, or null. */
export function printWarning(width: number, height: number): string | null {
  if (!width || !height) return null;
  if (Math.min(width, height) >= PRINT_MIN_SHORT_SIDE) return null;
  return `This photo is quite small (${width} × ${height} pixels), so it may look a little soft when printed. You can still include it.`;
}

/** "3.4 MB" */
export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
