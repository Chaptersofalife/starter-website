// What happens when Stripe tells us about a payment (server only).
// These are called ONLY from the Stripe webhook (src/app/api/stripe/webhook),
// after Stripe's signature has been checked. Landing on the thank-you page
// never marks an order as paid.
import "server-only";
import type Stripe from "stripe";
import { formatDate } from "@/lib/books";
import { sendEmails } from "@/lib/email";
import { newOrderAdminEmail, orderConfirmationEmail } from "@/lib/email-templates";
import { PREVIEW_WORKING_DAYS, addressLines, formatPounds } from "@/lib/orders";
import { contactEmail, siteUrl } from "@/lib/site";
import { stripeTestMode } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase/admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A short reference people can quote, e.g. "COAL-1A2B3C4D". */
export function orderReference(orderId: string) {
  return `COAL-${orderId.slice(0, 8).toUpperCase()}`;
}

function orderIdFrom(session: Stripe.Checkout.Session) {
  const id = session.client_reference_id ?? session.metadata?.order_id ?? "";
  return uuid.test(id) ? id : null;
}

const unpaid = ["awaiting_payment", "expired", "payment_failed"];

/** Stripe confirmed payment: mark the order paid (once) and send the emails (once). */
export async function confirmPaidSession(session: Stripe.Checkout.Session): Promise<string> {
  const admin = getAdminClient();
  const orderId = orderIdFrom(session);
  if (!admin || !orderId) return "no order id";
  if (session.payment_status !== "paid") return "not paid yet";

  const { data: order } = await admin
    .from("orders")
    .select("id, status, amount_pence, currency")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return "order not found";

  // The amount Stripe took must match the order exactly.
  if (session.amount_total !== order.amount_pence || session.currency !== order.currency) {
    console.error("Stripe amount mismatch for order", orderId, session.amount_total, session.currency);
    return "amount mismatch: not marked as paid";
  }

  if (unpaid.includes(order.status)) {
    const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    await admin
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        status_changed_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntent ?? null,
      })
      .eq("id", orderId)
      .in("status", unpaid); // only if still unpaid, so repeats change nothing
  }

  await sendOrderEmails(orderId);
  return "paid";
}

/** Stripe said a delayed payment failed. */
export async function markPaymentFailed(session: Stripe.Checkout.Session) {
  const admin = getAdminClient();
  const orderId = orderIdFrom(session);
  if (!admin || !orderId) return;
  await admin
    .from("orders")
    .update({ status: "payment_failed", status_changed_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "awaiting_payment");
}

/** They left Stripe Checkout without paying (it expires after 24 hours). */
export async function markExpired(session: Stripe.Checkout.Session) {
  const admin = getAdminClient();
  const orderId = orderIdFrom(session);
  if (!admin || !orderId) return;
  await admin
    .from("orders")
    .update({ status: "expired", status_changed_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "awaiting_payment");
}

/** A payment was refunded in full (refunds are made in the Stripe dashboard). */
export async function markRefunded(charge: Stripe.Charge) {
  const admin = getAdminClient();
  const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!admin || !paymentIntent || !charge.refunded) return;
  await admin
    .from("orders")
    .update({ status: "refunded", status_changed_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", paymentIntent);
}

/** The organiser's confirmation and your "New order" email, sent once per order. */
async function sendOrderEmails(orderId: string) {
  const admin = getAdminClient();
  if (!admin) return;

  // Claim the order first, so that if Stripe sends the same event twice at
  // once, the emails still only go out once.
  const { data: claimed } = await admin
    .from("orders")
    .update({ confirmation_emails_sent_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("confirmation_emails_sent_at", null)
    .select("*");
  const order = claimed?.[0];
  if (!order) return;

  const { data: profile } = order.organiser_id
    ? await admin.from("profiles").select("full_name").eq("id", order.organiser_id).maybeSingle()
    : { data: null };
  const organiserName = (profile?.full_name || order.organiser_email.split("@")[0]).trim();

  const details = {
    orderRef: orderReference(order.id),
    bookName: order.book_name,
    totalCopies: order.total_copies,
    extraCopies: order.extra_copies,
    amount: formatPounds(order.amount_pence),
    address: addressLines(order),
    paidOn: formatDate((order.paid_at ?? new Date().toISOString()).slice(0, 10)),
  };

  const confirmation = orderConfirmationEmail({
    ...details,
    organiserFirstName: organiserName.split(/\s+/)[0],
    previewDays: PREVIEW_WORKING_DAYS,
    bookUrl: order.book_id ? `${siteUrl}/my-books/${order.book_id}` : `${siteUrl}/my-books`,
  });
  const forAdmin = newOrderAdminEmail({
    ...details,
    organiserName,
    organiserEmail: order.organiser_email,
    adminUrl: `${siteUrl}/admin/orders`,
    testMode: stripeTestMode(),
  });

  const result = await sendEmails([
    { to: order.organiser_email, ...confirmation, replyTo: contactEmail },
    { to: contactEmail, ...forAdmin, replyTo: order.organiser_email },
  ]);
  if (result.failed > 0) {
    console.error("Order emails failed for", orderId, result.error);
  }
}
