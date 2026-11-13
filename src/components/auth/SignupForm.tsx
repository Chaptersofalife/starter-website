"use client";

import { useActionState } from "react";
import { signUp, type FormState } from "@/app/auth/actions";
import FormError from "./FormError";

export default function SignupForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(signUp, {});

  if (state.sentTo) {
    return (
      <div className="form-success" role="status">
        <h2>Please check your email</h2>
        <p>
          We&rsquo;ve sent a link to <strong>{state.sentTo}</strong>. Open it to
          confirm your email address, and you&rsquo;ll be taken straight to
          your account.
        </p>
        <p>
          It works best if you open the email on this same phone or computer.
          If it doesn&rsquo;t arrive in a few minutes, please look in your
          spam folder.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="form">
      <div className="field">
        <label htmlFor="signup-name">Your name</label>
        <input id="signup-name" name="name" type="text" autoComplete="name" required />
      </div>

      <div className="field">
        <label htmlFor="signup-email">Your email</label>
        <input id="signup-email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="field">
        <label htmlFor="signup-password">Choose a password</label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          aria-describedby="signup-password-hint"
          required
        />
        <p id="signup-password-hint" className="field-hint">
          At least 8 characters. A few words together is easy to remember.
        </p>
      </div>

      <FormError message={state.error} />

      <div>
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Creating your account…" : "Create account"}
        </button>
      </div>
    </form>
  );
}
