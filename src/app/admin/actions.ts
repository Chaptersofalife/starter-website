"use server";

// Admin-only actions. Each one checks, on the server, that the signed-in
// person is an admin before doing anything.

import { getAdmin } from "@/lib/admin";
import { emailConfigured } from "@/lib/email";
import { runReminders, sendTestEmails, type ReminderReport } from "@/lib/reminders";
import { requestOrigin } from "@/lib/request-origin";
import { siteUrl } from "@/lib/site";
import { isBookId, lifeDates } from "@/lib/books";
import { adminStatusChoices } from "@/lib/orders";
import { mimeToExtension, printWarning, type PhotoMime } from "@/lib/photos";
import { signedDownloadUrl } from "@/lib/photos-server";
import { PHOTO_BUCKET, getAdminClient } from "@/lib/supabase/admin";

/** A one-hour link to download any original photo (admins only). */
export async function adminDownloadUrl(photoId: string): Promise<string | null> {
  if (!(await getAdmin()) || !isBookId(photoId)) return null;
  const admin = getAdminClient();
  if (!admin) return null;
  const { data: photo } = await admin
    .from("memory_photos")
    .select("original_path, original_name, mime_type, position")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return null;
  const ext = mimeToExtension[photo.mime_type as PhotoMime] ?? "jpg";
  return signedDownloadUrl(photo.original_path, photo.original_name || `photo-${photo.position + 1}.${ext}`);
}

// ---------------------------------------------------------------------------
// "Download for layout"
// ---------------------------------------------------------------------------

export type LayoutPhoto = {
  /** e.g. "M03-P02": memory 3, photo 2. */
  code: string;
  /** Where it goes in the zip, e.g. "photos/M03-P02 Susan Ellis.heic". */
  zipPath: string;
  /** A one-hour link to the original, full-quality file. */
  url: string;
  caption: string | null;
  taken: string | null;
  width: number | null;
  height: number | null;
  warning: string | null;
};

export type LayoutPackage = {
  fileBase: string;
  book: {
    fullName: string;
    knownAs: string | null;
    dates: string;
    livedIn: string | null;
    introduction: string | null;
  };
  cover: { zipPath: string; url: string } | null;
  memories: {
    number: string;
    contributorName: string;
    relationship: string;
    text: string;
    sayings: string | null;
    edited: boolean;
    photos: LayoutPhoto[];
  }[];
  preparedAt: string;
};

/** Makes text safe to use in a file name. */
function fileSafe(text: string, max = 40) {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9 '-]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max)
      .trim() || "Unknown"
  );
}

/**
 * Everything needed to build the layout zip in the admin's browser:
 * the book details, APPROVED memories in the order they arrived, and links
 * to each non-hidden photo's full-quality original.
 * (The browser builds the zip because a book's photos are too large to send
 * through our server in one go.)
 */
export async function getLayoutPackage(bookId: string): Promise<LayoutPackage | { error: string }> {
  if (!(await getAdmin())) return { error: "Only admins can download books." };
  if (!isBookId(bookId)) return { error: "We couldn't find this book." };
  const admin = getAdminClient();
  if (!admin) return { error: "Photos aren't set up yet (the secret key is missing)." };

  const [{ data: book }, { data: memories }, { data: photos }] = await Promise.all([
    admin
      .from("books")
      .select("full_name, known_as, date_of_birth, date_of_death, lived_in, introduction, cover_original_path")
      .eq("id", bookId)
      .maybeSingle(),
    admin
      .from("memories")
      .select("id, contributor_name, relationship, memory, sayings, edited_memory, edited_sayings, created_at")
      .eq("book_id", bookId)
      .eq("status", "approved")
      .order("created_at", { ascending: true }),
    admin
      .from("memory_photos")
      .select("memory_id, position, original_path, caption, taken_text, width, height")
      .eq("book_id", bookId)
      .eq("uploaded", true)
      .eq("hidden", false)
      .order("position"),
  ]);
  if (!book) return { error: "We couldn't find this book." };

  const approved = memories ?? [];
  const digits = approved.length >= 100 ? 3 : 2;
  const pad = (n: number) => String(n).padStart(digits, "0");

  // Number each memory and its photos, and plan their file names.
  const planned = approved.map((m, i) => {
    const number = pad(i + 1);
    const memoryPhotos = (photos ?? []).filter((p) => p.memory_id === m.id);
    return {
      memory: m,
      number,
      photos: memoryPhotos.map((p, j) => {
        const code = `M${number}-P${String(j + 1).padStart(2, "0")}`;
        const ext = p.original_path.split(".").pop() ?? "jpg";
        return { p, code, zipPath: `photos/${code} ${fileSafe(m.contributor_name)}.${ext}` };
      }),
    };
  });

  // One-hour links to every original (and the cover).
  const paths = [
    ...(book.cover_original_path ? [book.cover_original_path] : []),
    ...planned.flatMap((m) => m.photos.map((x) => x.p.original_path)),
  ];
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed, error } = await admin.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
    if (error) return { error: "We couldn't prepare the photos just now. Please try again." };
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  return {
    fileBase: `${fileSafe(book.full_name, 60).replace(/ /g, "-")}-layout-${today}`,
    book: {
      fullName: book.full_name,
      knownAs: book.known_as,
      dates: lifeDates(book),
      livedIn: book.lived_in,
      introduction: book.introduction,
    },
    cover:
      book.cover_original_path && urls.get(book.cover_original_path)
        ? {
            zipPath: `cover.${book.cover_original_path.split(".").pop() ?? "jpg"}`,
            url: urls.get(book.cover_original_path)!,
          }
        : null,
    memories: planned.map(({ memory: m, number, photos: ps }) => ({
      number,
      contributorName: m.contributor_name,
      relationship: m.relationship,
      text: m.edited_memory ?? m.memory,
      sayings: m.edited_sayings ?? m.sayings,
      edited: m.edited_memory !== null || m.edited_sayings !== null,
      photos: ps
        .filter((x) => urls.has(x.p.original_path))
        .map((x) => ({
          code: x.code,
          zipPath: x.zipPath,
          url: urls.get(x.p.original_path)!,
          caption: x.p.caption,
          taken: x.p.taken_text,
          width: x.p.width,
          height: x.p.height,
          warning: printWarning(x.p.width ?? 0, x.p.height ?? 0),
        })),
    })),
    preparedAt: new Intl.DateTimeFormat("en-GB", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/London",
    }).format(new Date()),
  };
}

// ---------------------------------------------------------------------------
// Reminder emails (admin testing)
// ---------------------------------------------------------------------------

/**
 * Runs the real daily reminder check now. It follows the same rules as the
 * daily run, so it only emails people who are due a reminder today.
 */
export async function adminRunReminders(): Promise<ReminderReport | { error: string }> {
  if (!(await getAdmin())) return { error: "Only admins can do this." };
  if (!emailConfigured()) return { error: "RESEND_API_KEY is missing, so emails can't be sent." };
  return runReminders(siteUrl);
}

/** Sends one sample of every email for a book to the admin only, marked [TEST]. */
export async function adminSendTestEmails(bookId: string): Promise<{ ok: boolean; message: string }> {
  const admin = await getAdmin();
  if (!admin?.email) return { ok: false, message: "Only admins can do this." };
  if (!isBookId(bookId)) return { ok: false, message: "We couldn't find this book." };
  if (!emailConfigured()) return { ok: false, message: "RESEND_API_KEY is missing, so emails can't be sent." };
  const result = await sendTestEmails(bookId, admin.email, await requestOrigin());
  if (result.error && result.sent === 0) return { ok: false, message: result.error };
  return {
    ok: result.failed === 0,
    message:
      result.failed === 0
        ? `Sent ${result.sent} test emails to ${admin.email}.`
        : `Sent ${result.sent}, but ${result.failed} failed: ${result.error ?? "unknown problem"}`,
  };
}

// ---------------------------------------------------------------------------
// Orders (admin)
// ---------------------------------------------------------------------------

/** Changes an order's status (admins only). */
export async function adminSetOrderStatus(orderId: string, status: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await getAdmin())) return { ok: false, error: "Only admins can do this." };
  if (!isBookId(orderId)) return { ok: false, error: "Order not found." };
  if (!(adminStatusChoices as string[]).includes(status)) return { ok: false, error: "Please choose a status." };
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "SUPABASE_SECRET_KEY is missing." };

  // Only paid orders can move through the production steps.
  const { data, error } = await admin
    .from("orders")
    .update({ status, status_changed_at: new Date().toISOString() })
    .eq("id", orderId)
    .in("status", adminStatusChoices)
    .select("id");
  if (error) return { ok: false, error: "Sorry, that didn't save. Please try again." };
  if (!data || data.length === 0) return { ok: false, error: "Only paid orders can be updated." };
  return { ok: true };
}
