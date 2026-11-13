"use server";

// What happens when someone submits the sign-up, log-in and password forms.
// These run on the server, never in the visitor's browser.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  /** A problem to show the person, in plain words. */
  error?: string;
  /** Set once an email has been sent, so the form can show a confirmation. */
  sentTo?: string;
};

const MIN_PASSWORD_LENGTH = 8;

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

// The address of the site the person is using (live site, preview or
// their own computer), so email links bring them back to the same place.
async function siteOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

// ---------------------------------------------------------------------------

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = field(formData, "name");
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) {
    return { error: "Please fill in your name, email and a password." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Please choose a password of at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
    },
  });

  if (error) {
    return { error: friendlyError(error.code, error.message) };
  }

  // If Supabase is set not to require email confirmation, they're signed in already.
  if (data.session) {
    redirect("/my-books");
  }

  return { sentTo: email };
}

export async function logIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: friendlyError(error.code, error.message) };
  }

  redirect("/my-books");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email");
  if (!email) {
    return { error: "Please enter your email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/confirm`,
  });

  // Only report problems on our side. We never say whether an account exists,
  // so nobody can use this form to find out who has an account.
  if (error && error.status !== 400 && error.status !== 404) {
    return { error: friendlyError(error.code, error.message) };
  }

  return { sentTo: email };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Please choose a password of at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) {
    return { error: "The two passwords don't match. Please type them again." };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "This reset link has expired. Please ask for a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: friendlyError(error.code, error.message) };
  }

  redirect("/my-books");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------------------------------------------------------------------------

// Turns Supabase's technical messages into plain, kind words.
function friendlyError(code: string | undefined, message: string) {
  switch (code) {
    case "invalid_credentials":
      return "That email and password don't match. Please try again, or reset your password.";
    case "email_not_confirmed":
      return "Please confirm your email address first. Check your inbox for the link we sent you.";
    case "user_already_exists":
    case "email_exists":
      return "There's already an account with this email. Please log in instead.";
    case "weak_password":
      return "Please choose a stronger password, for example a few words together.";
    case "same_password":
      return "Please choose a password you haven't used before.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "We've had a lot of requests. Please wait a few minutes and try again.";
    case "email_address_invalid":
      return "Please check your email address is typed correctly.";
    default:
      console.error("Supabase auth error:", code, message);
      return "Something went wrong on our side. Please try again in a moment.";
  }
}
