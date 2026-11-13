// Where the links in sign-up and password-reset emails lead.
//
// With Supabase's standard emails, the link goes to Supabase first. Supabase
// checks it (and marks a new account's email as confirmed), then sends the
// person here with a one-time `code`, plus the `next` page we asked for:
//   ?next=/my-books        after confirming a new account
//   ?next=/reset-password  after asking to reset a password
// We swap the code for a sign-in, then send them on to that page.
//
// The code only works in the same browser where they signed up or asked for
// the reset (it's paired with a cookie saved there). If they open the email
// on another device, we explain what to do instead.
//
// Later, with custom email templates, links can carry `token_hash` and `type`
// instead, which work on any device. That's handled here too.

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowedNext = ["/my-books", "/reset-password"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const requestedNext = searchParams.get("next") ?? "";
  const next = allowedNext.includes(requestedNext) ? requestedNext : "/my-books";
  const isReset = next === "/reset-password";

  // Supabase sends an error instead of a code if the link has expired or was already used.
  if (searchParams.get("error") || searchParams.get("error_code")) {
    return redirectTo(request, "/auth/link-expired");
  }

  const supabase = await createClient();

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectTo(request, next);
    }
    // Usually means the link was opened in a different browser or device.
    // A new account's email is confirmed already, so they can just log in.
    return redirectTo(request, isReset ? "/auth/link-expired" : "/auth/email-confirmed");
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return redirectTo(request, type === "recovery" ? "/reset-password" : next);
    }
  }

  return redirectTo(request, "/auth/link-expired");
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}
