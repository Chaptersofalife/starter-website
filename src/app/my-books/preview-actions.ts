"use server";

// The organiser's response to a preview: "Approve and print", or "Request
// changes". Row Level Security confirms it's their order; the server then
// records the response.

import { revalidatePath } from "next/cache";
import { isBookId } from "@/lib/books";
import { sendEmails } from "@/lib/email";
import { previewResponseAdminEmail } from "@/lib/email-templates";
import { orderReference } from "@/lib/order-payments";
import { CHANGES_MESSAGE_MAX } from "@/lib/orders";
import { lockBookForPrint } from "@/lib/previews";
import { contactEmail, siteUrl } from "@/lib/site";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PreviewResult = { ok: boolean; error?: string };

/** The organiser's order and its newest preview, if it's waiting for a response. */
async function pendingPreview(orderId: string) {
  if (!isBookId(orderId)) return null;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  // Row Level Security: only the organiser's own order and previews are found.
  const [{ data: order }, { data: preview }] = await Promise.all([
    supabase.from("orders").select("id, status, book_id, book_name, organiser_email").eq("id", orderId).maybeSingle(),
    supabase
      .from("order_previews")
      .select("id, version, response")
      .eq("order_id", orderId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!order || !preview) return null;
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userData.user.id).maybeSingle();
  return { order, preview, organiserName: (profile?.full_name || order.organiser_email.split("@")[0]).trim() };
}

async function notifyAdmin(
  ctx: NonNullable<Awaited<ReturnType<typeof pendingPreview>>>,
  approved: boolean,
  message: string | null,
) {
  const email = previewResponseAdminEmail({
    approved,
    orderRef: orderReference(ctx.order.id),
    bookName: ctx.order.book_name,
    organiserName: ctx.organiserName,
    organiserEmail: ctx.order.organiser_email,
    version: ctx.preview.version,
    message,
    adminUrl: `${siteUrl}/admin/orders`,
  });
  await sendEmails([{ to: contactEmail, ...email, replyTo: ctx.order.organiser_email }]);
}

/** "Approve and print": the order is approved, and the book is locked. */
export async function approvePreview(orderId: string): Promise<PreviewResult> {
  const ctx = await pendingPreview(orderId);
  if (!ctx) return { ok: false, error: "We couldn't find this preview. Please refresh the page." };
  if (ctx.order.status !== "preview_sent" || ctx.preview.response) {
    return { ok: false, error: "This preview has already been answered. Please refresh the page." };
  }
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Sorry, that didn't work. Please try again." };

  const now = new Date().toISOString();
  const { data } = await admin
    .from("orders")
    .update({ status: "approved", approved_at: now, status_changed_at: now })
    .eq("id", ctx.order.id)
    .eq("status", "preview_sent")
    .select("id");
  if (!data || data.length === 0) return { ok: false, error: "This preview has already been answered. Please refresh the page." };
  await admin.from("order_previews").update({ response: "approved", responded_at: now }).eq("id", ctx.preview.id);
  if (ctx.order.book_id) await lockBookForPrint(ctx.order.book_id);

  await notifyAdmin(ctx, true, null);
  if (ctx.order.book_id) {
    revalidatePath(`/my-books/${ctx.order.book_id}`);
    revalidatePath(`/my-books/${ctx.order.book_id}/preview`);
  }
  return { ok: true };
}

/** "Request changes": tells us what to change. */
export async function requestPreviewChanges(orderId: string, message: string): Promise<PreviewResult> {
  const text = message.trim();
  if (!text) return { ok: false, error: "Please tell us what you'd like changed." };
  if (text.length > CHANGES_MESSAGE_MAX) {
    return { ok: false, error: `Please keep your message to ${CHANGES_MESSAGE_MAX.toLocaleString("en-GB")} characters or fewer.` };
  }
  const ctx = await pendingPreview(orderId);
  if (!ctx) return { ok: false, error: "We couldn't find this preview. Please refresh the page." };
  if (ctx.order.status !== "preview_sent" || ctx.preview.response) {
    return { ok: false, error: "This preview has already been answered. Please refresh the page." };
  }
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Sorry, that didn't work. Please try again." };

  const now = new Date().toISOString();
  const { data } = await admin
    .from("orders")
    .update({ status: "changes_requested", status_changed_at: now })
    .eq("id", ctx.order.id)
    .eq("status", "preview_sent")
    .select("id");
  if (!data || data.length === 0) return { ok: false, error: "This preview has already been answered. Please refresh the page." };
  await admin
    .from("order_previews")
    .update({ response: "changes_requested", response_message: text, responded_at: now })
    .eq("id", ctx.preview.id);

  await notifyAdmin(ctx, false, text);
  if (ctx.order.book_id) {
    revalidatePath(`/my-books/${ctx.order.book_id}`);
    revalidatePath(`/my-books/${ctx.order.book_id}/preview`);
  }
  return { ok: true };
}
