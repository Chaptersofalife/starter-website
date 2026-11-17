"use client";

import { useActionState } from "react";
import { updatePassword, type FormState } from "@/app/auth/actions";
import FormError from "./FormError";

export default function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updatePassword, {});

  return (
    <form action={formAction} className="form">
      <div className="field">
        <label htmlFor="reset-password">New password</label>
        <input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          aria-describedby="reset-password-hint"
          required
        />
        <p id="reset-password-hint" className="field-hint">
          At least 8 characters.
        </p>
      </div>

      <div className="field">
        <label htmlFor="reset-confirm">Type it again</label>
        <input
          id="reset-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <FormError message={state.error} />

      <div>
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving…" : "Save new password"}
        </button>
      </div>
    </form>
  );
}
