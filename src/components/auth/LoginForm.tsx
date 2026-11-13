"use client";

import Link from "next/link";
import { useActionState } from "react";
import { logIn, type FormState } from "@/app/auth/actions";
import FormError from "./FormError";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(logIn, {});

  return (
    <form action={formAction} className="form">
      <div className="field">
        <label htmlFor="login-email">Your email</label>
        <input id="login-email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="field">
        <div className="field-label-row">
          <label htmlFor="login-password">Password</label>
          <Link href="/forgot-password">Forgot your password?</Link>
        </div>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <FormError message={state.error} />

      <div>
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </button>
      </div>
    </form>
  );
}
