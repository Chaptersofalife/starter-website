// Keeps organisers signed in, and protects private pages.
// Called from src/proxy.ts before account pages load.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseKey, supabaseUrl } from "./config";

// Pages only signed-in organisers can see.
const privatePaths = ["/my-books", "/reset-password"];
// Pages signed-in organisers don't need (they go straight to My books).
const signedOutOnlyPaths = ["/login", "/signup"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Checks the sign-in is genuine, and refreshes it if it's about to expire.
  // Don't add code between createServerClient and this line.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  const path = request.nextUrl.pathname;
  const matches = (paths: string[]) =>
    paths.some((p) => path === p || path.startsWith(`${p}/`));

  if (!isSignedIn && matches(privatePaths)) {
    return redirectTo(request, "/login", response);
  }
  if (isSignedIn && matches(signedOutOnlyPaths)) {
    return redirectTo(request, "/my-books", response);
  }

  return response;
}

// Redirect while keeping any refreshed sign-in cookies.
function redirectTo(request: NextRequest, pathname: string, from: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
