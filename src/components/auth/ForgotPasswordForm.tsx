"use client";

import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/app/auth/actions";
import FormError from "./FormError";

export default function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.sentTo) {
    return (
      <div className="form-success" role="status">
        <h2>Please check your email</h2>
        <p>
          If there&rsquo;s an account for <strong>{state.sentTo}</strong>,
          we&rsquo;ve sent a link to choose a new password.
        </p>
        <p>
          Please open the email on this same phone or computer. If it
          doesn&rsquo;t arrive in a few minutes, please look in your spam
          folder.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="form">
      <div className="field">
        <label htmlFor="forgot-email">Your email</label>
        <input id="forgot-email" name="email" type="email" autoComplete="email" required />
      </div>

      <FormError message={state.error} />

      <div>
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </div>
    </form>
  );
}
