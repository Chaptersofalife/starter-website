// Stripe's webhook: chaptersofalife.co.uk/api/stripe/webhook
// Stripe calls this to confirm payments. Every message is checked against
// STRIPE_WEBHOOK_SECRET, so only genuine messages from Stripe are accepted.
// This is the ONLY place an order is marked as paid.
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { confirmPaidSession, markExpired, markPaymentFailed, markRefunded } from "@/lib/order-payments";
import { getStripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    console.error("Stripe webhook is not set up (missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET).");
    return NextResponse.json({ error: "Not set up" }, { status: 500 });
  }

  // The signature is checked against the exact text Stripe sent.
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const note = await confirmPaidSession(event.data.object);
        console.log(`Stripe ${event.type}: ${note}`);
        break;
      }
      case "checkout.session.async_payment_failed":
        await markPaymentFailed(event.data.object);
        break;
      case "checkout.session.expired":
        await markExpired(event.data.object);
        break;
      case "charge.refunded":
        await markRefunded(event.data.object);
        break;
      default:
        // Other events aren't needed.
        break;
    }
  } catch (e) {
    console.error("Stripe webhook handling failed:", event.type, e);
    // Asking Stripe to try again later.
    return NextResponse.json({ error: "Handling failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
