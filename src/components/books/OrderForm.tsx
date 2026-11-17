"use client";

// The order form: extra copies, delivery address, and "Pay".
// The total shown here is just for the organiser to see. The server works
// out the real price again before sending them to Stripe.

import Link from "next/link";
import { useActionState, useState } from "react";
import type { CheckoutState } from "@/app/my-books/order-actions";
import FormError from "@/components/auth/FormError";
import {
  BOOK_PRICE_PENCE,
  EXTRA_COPY_PENCE,
  MAX_EXTRA_COPIES,
  formatPounds,
  orderTotalPence,
  type DeliveryAddress,
} from "@/lib/orders";

type OrderFormProps = {
  action: (state: CheckoutState, formData: FormData) => Promise<CheckoutState>;
  /** A suggested delivery name (the organiser's name). */
  defaultName: string;
};

export default function OrderForm({ action, defaultName }: OrderFormProps) {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(action, {});
  const [extra, setExtra] = useState(Number(state.values?.extra_copies ?? 0) || 0);
  const errors = state.fieldErrors ?? {};
  const v = state.values;

  const field = (
    name: keyof DeliveryAddress,
    label: string,
    opts: { optional?: boolean; autoComplete?: string; type?: string; hint?: string; defaultValue?: string } = {},
  ) => (
    <div className="field">
      <label htmlFor={name}>
        {label} {opts.optional && <span className="optional">(optional)</span>}
      </label>
      <input
        id={name}
        name={name}
        type={opts.type ?? "text"}
        autoComplete={opts.autoComplete}
        defaultValue={v?.[name] ?? opts.defaultValue ?? ""}
        required={!opts.optional}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={[opts.hint ? `${name}-hint` : null, errors[name] ? `${name}-error` : null].filter(Boolean).join(" ") || undefined}
      />
      {opts.hint && (
        <p id={`${name}-hint`} className="field-hint">
          {opts.hint}
        </p>
      )}
      {errors[name] && (
        <p id={`${name}-error`} className="field-error">
          {errors[name]}
        </p>
      )}
    </div>
  );

  const total = orderTotalPence(extra);

  return (
    <form action={formAction} className="form" noValidate>
      <fieldset className="order-fieldset">
        <legend>Copies</legend>
        <div className="field">
          <label htmlFor="extra_copies">Extra copies, at {formatPounds(EXTRA_COPY_PENCE)} each</label>
          <select
            id="extra_copies"
            name="extra_copies"
            value={extra}
            onChange={(e) => setExtra(Number(e.target.value))}
          >
            {Array.from({ length: MAX_EXTRA_COPIES + 1 }, (_, n) => (
              <option key={n} value={n}>
                {n === 0 ? "No extra copies" : `${n} extra ${n === 1 ? "copy" : "copies"}`}
              </option>
            ))}
          </select>
          <p className="field-hint">For other family members. Every copy is identical.</p>
        </div>

        <dl className="order-summary">
          <div>
            <dt>Keepsake book</dt>
            <dd>{formatPounds(BOOK_PRICE_PENCE)}</dd>
          </div>
          {extra > 0 && (
            <div>
              <dt>
                {extra} extra {extra === 1 ? "copy" : "copies"}
              </dt>
              <dd>{formatPounds(extra * EXTRA_COPY_PENCE)}</dd>
            </div>
          )}
          <div>
            <dt>UK delivery</dt>
            <dd>Included</dd>
          </div>
          <div className="order-total">
            <dt>Total</dt>
            <dd>{formatPounds(total)}</dd>
          </div>
        </dl>
      </fieldset>

      <fieldset className="order-fieldset">
        <legend>Delivery address</legend>
        <p className="field-hint">We can deliver to UK addresses only, for now.</p>
        {field("delivery_name", "Full name", { autoComplete: "shipping name", defaultValue: defaultName })}
        {field("address_line1", "Address line 1", { autoComplete: "shipping address-line1" })}
        {field("address_line2", "Address line 2", { optional: true, autoComplete: "shipping address-line2" })}
        <div className="field-row">
          {field("town", "Town or city", { autoComplete: "shipping address-level2" })}
          {field("county", "County", { optional: true, autoComplete: "shipping address-level1" })}
        </div>
        {field("postcode", "Postcode", { autoComplete: "shipping postal-code" })}
        {field("phone", "Phone number", {
          optional: true,
          type: "tel",
          autoComplete: "tel",
          hint: "Only used by the courier if they need to reach you about delivery.",
        })}
      </fieldset>

      <FormError message={state.error} />

      <div className="order-pay">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Opening secure payment…" : `Pay ${formatPounds(total)}`}
        </button>
        <p className="field-hint">
          You&rsquo;ll be taken to Stripe&rsquo;s secure payment page. Cards, Apple Pay and Google Pay
          are accepted. By paying, you agree to our <Link href="/terms">Terms &amp; Conditions</Link>.
        </p>
      </div>
    </form>
  );
}
