"use server";

// Starting a payment. The order is saved as "awaiting payment", then the
// organiser is sent to Stripe Checkout. It's only marked as paid when Stripe
// confirms it through the webhook.

import { redirect } from "next/navigation";
import { isBookId } from "@/lib/books";
import { isOpen } from "@/lib/closing";
import {
  BOOK_PRICE_PENCE,
  EXTRA_COPY_PENCE,
  MAX_EXTRA_COPIES,
  PRODUCT_DESCRIPTION,
  PRODUCT_NAME,
  normalisePostcode,
  orderTotalPence,
  type DeliveryAddress,
} from "@/lib/orders";
import { requestOrigin } from "@/lib/request-origin";
import { getStripe } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CheckoutState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof DeliveryAddress, string>>;
  values?: DeliveryAddress & { extra_copies: string };
};

const limits: Record<keyof DeliveryAddress, number> = {
  delivery_name: 100,
  address_line1: 120,
  address_line2: 120,
  town: 80,
  county: 80,
  postcode: 10,
  phone: 30,
};

export async function startCheckout(bookId: string, _prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const get = (name: string) => String(formData.get(name) ?? "").trim();
  const values = {
    delivery_name: get("delivery_name"),
    address_line1: get("address_line1"),
    address_line2: get("address_line2"),
    town: get("town"),
    county: get("county"),
    postcode: get("postcode"),
    phone: get("phone"),
    extra_copies: get("extra_copies"),
  };

  // Check the answers.
  const fieldErrors: CheckoutState["fieldErrors"] = {};
  if (!values.delivery_name) fieldErrors.delivery_name = "Please enter the name for delivery.";
  if (!values.address_line1) fieldErrors.address_line1 = "Please enter the first line of the address.";
  if (!values.town) fieldErrors.town = "Please enter the town or city.";
  const postcode = normalisePostcode(values.postcode);
  if (!values.postcode) fieldErrors.postcode = "Please enter the postcode.";
  else if (!postcode) fieldErrors.postcode = "Please check the postcode. We can only deliver to UK addresses for now.";
  if (values.phone && !/^[+()\d\s-]{7,30}$/.test(values.phone)) fieldErrors.phone = "Please check the phone number.";
  for (const [key, max] of Object.entries(limits) as [keyof DeliveryAddress, number][]) {
    if (!fieldErrors[key] && values[key].length > max) fieldErrors[key] = `Please keep this to ${max} characters or fewer.`;
  }
  const extraCopies = Number(values.extra_copies);
  if (!Number.isInteger(extraCopies) || extraCopies < 0 || extraCopies > MAX_EXTRA_COPIES) {
    return { values, error: `Please choose between 0 and ${MAX_EXTRA_COPIES} extra copies.` };
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { values, fieldErrors, error: "Please check the highlighted answers." };
  }

  // Check it's their book, and that it's closed (ready to order).
  if (!isBookId(bookId)) return { values, error: "We couldn't find this book." };
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user?.email) redirect("/login");
  const { data: book } = await supabase
    .from("books")
    .select("id, full_name, closes_on, closed_at")
    .eq("id", bookId)
    .maybeSingle();
  if (!book) return { values, error: "We couldn't find this book." };
  if (isOpen({ closesOn: book.closes_on, closedAt: book.closed_at })) {
    return { values, error: "Please close the book to new memories before ordering." };
  }

  const stripe = getStripe();
  const admin = getAdminClient();
  if (!stripe || !admin) {
    return { values, error: "Payments aren't available just now. Please try again later." };
  }

  // Save the order as "awaiting payment". The price is worked out here, on
  // the server, so it can't be changed in the browser.
  const amount = orderTotalPence(extraCopies);
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      book_id: book.id,
      organiser_id: user.id,
      organiser_email: user.email,
      book_name: book.full_name,
      extra_copies: extraCopies,
      total_copies: extraCopies + 1,
      amount_pence: amount,
      currency: "gbp",
      delivery_name: values.delivery_name,
      address_line1: values.address_line1,
      address_line2: values.address_line2 || null,
      town: values.town,
      county: values.county || null,
      postcode,
      phone: values.phone || null,
    })
    .select("id")
    .single();
  if (orderError || !order) {
    console.error("Saving order failed:", orderError?.code, orderError?.message);
    return { values, error: "Sorry, your order couldn't be started. Please try again." };
  }

  // Send them to Stripe Checkout.
  const origin = await requestOrigin();
  let checkoutUrl: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Cards only. Apple Pay and Google Pay are card wallets, so they appear
      // on devices that support them (once turned on in Stripe's settings).
      allowed_payment_method_types: ["card"],
      customer_email: user.email,
      client_reference_id: order.id,
      metadata: { order_id: order.id, book_id: book.id },
      payment_intent_data: {
        description: `${PRODUCT_NAME} for ${book.full_name}`,
        metadata: { order_id: order.id, book_id: book.id },
      },
      locale: "en-GB",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: BOOK_PRICE_PENCE,
            product_data: { name: `${PRODUCT_NAME}: ${book.full_name}`, description: PRODUCT_DESCRIPTION },
          },
        },
        ...(extraCopies > 0
          ? [
              {
                quantity: extraCopies,
                price_data: {
                  currency: "gbp",
                  unit_amount: EXTRA_COPY_PENCE,
                  product_data: { name: "Extra copy", description: "An additional copy of the same book." },
                },
              },
            ]
          : []),
      ],
      success_url: `${origin}/my-books/${book.id}/order/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/my-books/${book.id}/order?cancelled=1`,
    });
    await admin.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
    checkoutUrl = session.url;
  } catch (e) {
    console.error("Creating Stripe Checkout failed:", e);
    await admin.from("orders").update({ status: "payment_failed" }).eq("id", order.id);
  }

  if (!checkoutUrl) {
    return { values, error: "Sorry, we couldn't open the payment page just now. Please try again." };
  }
  redirect(checkoutUrl);
}
