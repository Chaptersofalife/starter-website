// Connects to Supabase from the server (pages, server actions, route handlers).
// It reads and writes the login cookies, so Supabase knows who is signed in.
//
// Example:
//   const supabase = await createClient();
//   const { data } = await supabase.from("books").select();

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseKey, supabaseUrl } from "./config";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Pages can't change cookies, only actions and route handlers can.
          // This is safe to ignore: sign-in sessions are refreshed elsewhere.
        }
      },
    },
  });
}
