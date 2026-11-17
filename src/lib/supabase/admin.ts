// Connects to Supabase with the SECRET key, from the server only.
//
// The secret key can do anything, so it's only used for photos, which live in
// a private storage bucket that nobody else can reach. Always check who is
// asking (the book's organiser, or a valid invite link) BEFORE using this.
//
// "server-only" makes the build fail if this file is ever used in code that
// runs in the visitor's browser, so the key can't leak.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";

let admin: SupabaseClient | null | undefined;

/**
 * The secret-key connection, or null if SUPABASE_SECRET_KEY hasn't been
 * added yet (photo features then switch off politely instead of breaking).
 */
export function getAdminClient(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    console.error(
      "SUPABASE_SECRET_KEY is missing. Add it to .env.local and to Netlify's " +
        "environment variables to turn on photo uploads.",
    );
    admin = null;
    return admin;
  }
  admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** The private bucket all photos live in. */
export const PHOTO_BUCKET = "book-photos";
