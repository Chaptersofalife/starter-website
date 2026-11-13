// Runs before account pages load, to keep organisers signed in and to
// protect private pages. Other pages (home, how it works...) skip it,
// so they stay fast.
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/my-books/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ],
};
