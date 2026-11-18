// Connects to Stripe with the SECRET key (server only).
// Uses STRIPE_SECRET_KEY from .env.local / Netlify's environment variables.
import "server-only";
import Stripe from "stripe";

let stripe: Stripe | null | undefined;

/** The Stripe connection, or null if STRIPE_SECRET_KEY hasn't been added. */
export function getStripe(): Stripe | null {
  if (stripe !== undefined) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY is missing, so payments are switched off.");
    stripe = null;
    return stripe;
  }
  stripe = new Stripe(key, { appInfo: { name: "Chapters of a Life" } });
  return stripe;
}

/** True when using Stripe's test keys (no real money moves). */
export function stripeTestMode() {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}
