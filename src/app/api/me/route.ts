// Tells the menu whether the visitor is signed in, and whether they're an
// admin: chaptersofalife.co.uk/api/me
// It uses exactly the same server-side checks as the private pages, so the
// menu always matches what the person can actually open.
// (Showing or hiding the "Admin" link is only a convenience. The admin pages
// check on the server themselves.)
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const signedIn = Boolean(data.user);
  const isAdmin = signedIn ? Boolean(await getAdmin()) : false;
  return NextResponse.json(
    { signedIn, isAdmin },
    // Never stored anywhere: it's different for every person.
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
