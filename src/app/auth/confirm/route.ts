// Where the links in sign-up and password-reset emails lead.
// It checks the link with Supabase, signs the person in, then sends them on:
//   confirming a new account  -> My books
//   resetting a password      -> the "choose a new password" page

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return redirectTo(request, type === "recovery" ? "/reset-password" : "/my-books");
    }
  } else if (code) {
    // Older style of email link. Works when opened in the same browser.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectTo(request, "/my-books");
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
