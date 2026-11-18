"use server";

// Admin-only actions. Each one checks, on the server, that the signed-in
// person is an admin before doing anything.

import { getAdmin } from "@/lib/admin";
import { emailConfigured, sendEmails } from "@/lib/email";
import { dispatchedEmail, previewReadyEmail } from "@/lib/email-templates";
import { lockBookForPrint, newPreviewPath, previewExists, previewUploadPass, signedPreviewUrl } from "@/lib/previews";
import { runReminders, sendTestEmails, type ReminderReport } from "@/lib/reminders";
import { requestOrigin } from "@/lib/request-origin";
import { contactEmail, siteUrl } from "@/lib/site";
import { isBookId, lifeDates } from "@/lib/books";
import { MAX_PREVIEW_BYTES, addressLines, adminStatusChoices, previewableStatuses } from "@/lib/orders";
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

/** Changes an order's status (admins only). Dispatched needs tracking details. */
export async function adminSetOrderStatus(
  orderId: string,
  status: string,
  tracking?: { number?: string; url?: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!(await getAdmin())) return { ok: false, error: "Only admins can do this." };
  if (!isBookId(orderId)) return { ok: false, error: "Order not found." };
  if (!(adminStatusChoices as string[]).includes(status)) return { ok: false, error: "Please choose a status." };
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "SUPABASE_SECRET_KEY is missing." };

  const changes: Record<string, unknown> = { status, status_changed_at: new Date().toISOString() };
  if (status === "dispatched") {
    const number = (tracking?.number ?? "").trim();
    const url = (tracking?.url ?? "").trim();
    if (!number && !url) return { ok: false, error: "Please add a tracking number or a tracking link." };
    if (number.length > 100) return { ok: false, error: "The tracking number is too long." };
    if (url && (!/^https?:\/\/\S+$/.test(url) || url.length > 500)) {
      return { ok: false, error: "Please check the tracking link (it should start with https://)." };
    }
    Object.assign(changes, { tracking_number: number || null, tracking_url: url || null, dispatched_at: new Date().toISOString() });
  }
  if (status === "approved") changes.approved_at = new Date().toISOString();

  // Only paid orders can move through the production steps.
  const { data, error } = await admin
    .from("orders")
    .update(changes)
    .eq("id", orderId)
    .in("status", adminStatusChoices)
    .select("*");
  if (error) return { ok: false, error: "Sorry, that didn't save. Please try again." };
  const order = data?.[0];
  if (!order) return { ok: false, error: "Only paid orders can be updated." };

  if (status === "approved" && order.book_id) await lockBookForPrint(order.book_id);
  if (status === "dispatched") {
    const name = await organiserFirstName(order.organiser_id, order.organiser_email);
    const email = dispatchedEmail({
      organiserFirstName: name,
      bookName: order.book_name,
      totalCopies: order.total_copies,
      trackingNumber: order.tracking_number,
      trackingUrl: order.tracking_url,
      address: addressLines(order),
    });
    const sent = await sendEmails([{ to: order.organiser_email, ...email, replyTo: contactEmail }]);
    if (sent.failed > 0) return { ok: true, error: "Saved, but the email to the organiser couldn't be sent." };
  }
  return { ok: true };
}

async function organiserFirstName(organiserId: string | null, email: string) {
  const admin = getAdminClient();
  const { data } = organiserId && admin
    ? await admin.from("profiles").select("full_name").eq("id", organiserId).maybeSingle()
    : { data: null };
  return ((data?.full_name || email.split("@")[0]).trim().split(/\s+/)[0]) || "there";
}

// ---------------------------------------------------------------------------
// Preview PDFs (admin)
// ---------------------------------------------------------------------------

/** Step 1: a one-time pass to upload the next preview version. */
export async function adminPreparePreviewUpload(
  orderId: string,
  info: { size: number; type: string },
): Promise<{ ok: true; path: string; token: string; version: number } | { ok: false; error: string }> {
  if (!(await getAdmin())) return { ok: false, error: "Only admins can do this." };
  if (!isBookId(orderId)) return { ok: false, error: "Order not found." };
  if (info.type !== "application/pdf") return { ok: false, error: "Please choose a PDF file." };
  if (!(info.size > 0 && info.size <= MAX_PREVIEW_BYTES)) {
    return { ok: false, error: "The PDF is too large. Previews can be up to 50 MB." };
  }
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "SUPABASE_SECRET_KEY is missing." };

  const { data: order } = await admin.from("orders").select("id, status").eq("id", orderId).maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  if (!(previewableStatuses as string[]).includes(order.status)) {
    return { ok: false, error: "Previews can only be sent for paid orders that haven't been approved yet." };
  }
  const { data: latest } = await admin
    .from("order_previews")
    .select("version")
    .eq("order_id", orderId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (latest?.version ?? 0) + 1;
  try {
    const pass = await previewUploadPass(newPreviewPath(orderId, version));
    return { ok: true, ...pass, version };
  } catch {
    return { ok: false, error: "Couldn't prepare the upload. Has the database update been run?" };
  }
}

/** Step 2: after uploading, record the version, mark "Preview sent" and email the organiser. */
export async function adminPublishPreview(
  orderId: string,
  upload: { path: string; version: number; fileName: string; size: number },
): Promise<{ ok: boolean; error?: string; message?: string }> {
  if (!(await getAdmin())) return { ok: false, error: "Only admins can do this." };
  if (!isBookId(orderId)) return { ok: false, error: "Order not found." };
  const expected = new RegExp(`^${orderId}/v${upload.version}-[0-9a-f-]{36}\\.pdf$`);
  if (!expected.test(upload.path)) return { ok: false, error: "That upload doesn't belong to this order." };
  if (!(await previewExists(upload.path))) return { ok: false, error: "The PDF didn't finish uploading. Please try again." };
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "SUPABASE_SECRET_KEY is missing." };

  const { error: insertError } = await admin.from("order_previews").insert({
    order_id: orderId,
    version: upload.version,
    file_path: upload.path,
    file_name: upload.fileName.slice(0, 200) || null,
    size_bytes: upload.size,
  });
  if (insertError) return { ok: false, error: "Couldn't save the preview. Please try again." };

  const { data } = await admin
    .from("orders")
    .update({ status: "preview_sent", status_changed_at: new Date().toISOString() })
    .eq("id", orderId)
    .in("status", previewableStatuses)
    .select("*");
  const order = data?.[0];
  if (!order) return { ok: false, error: "The order can no longer receive previews." };

  const name = await organiserFirstName(order.organiser_id, order.organiser_email);
  const email = previewReadyEmail({
    organiserFirstName: name,
    bookName: order.book_name,
    version: upload.version,
    previewUrl: order.book_id ? `${siteUrl}/my-books/${order.book_id}/preview` : `${siteUrl}/my-books`,
  });
  const sent = await sendEmails([{ to: order.organiser_email, ...email, replyTo: contactEmail }]);
  return {
    ok: true,
    message:
      sent.failed > 0
        ? `Version ${upload.version} uploaded and marked "Preview sent", but the email couldn't be sent.`
        : `Version ${upload.version} uploaded. ${order.organiser_email} has been emailed.`,
  };
}

/** A one-hour link to view any preview version (admins only). */
export async function adminPreviewUrl(previewId: string): Promise<string | null> {
  if (!(await getAdmin()) || !isBookId(previewId)) return null;
  const admin = getAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("order_previews").select("file_path").eq("id", previewId).maybeSingle();
  return data ? signedPreviewUrl(data.file_path) : null;
}
