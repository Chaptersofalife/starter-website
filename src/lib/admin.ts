// Checks, on the server, that the signed-in person is an admin.
//
// Admins are listed in the "admins" table in Supabase (see
// supabase/migrations/20261117_admin.sql). The check uses the person's
// verified sign-in, and the database decides, so it can't be faked by
// hiding or guessing links.
import "server-only";
import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** The signed-in admin, or null if the person isn't signed in or isn't an admin. */
export async function getAdmin(): Promise<User | null> {
  const supabase = await createClient();
  // getUser() asks Supabase to confirm the sign-in is genuine.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) {
    console.error("Admin check failed:", error.code, error.message);
    return null;
  }
  return isAdmin === true ? userData.user : null;
}

/**
 * Use at the top of every admin page. Anyone who isn't an admin sees
 * "page not found", which doesn't even reveal that the page exists.
 */
export async function requireAdmin(): Promise<User> {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}
