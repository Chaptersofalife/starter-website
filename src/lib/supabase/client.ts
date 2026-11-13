// Connects to Supabase from the visitor's browser.
// Use this inside components that start with "use client".
//
// Example:
//   const supabase = createClient();
//   const { data } = await supabase.from("books").select();

import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./config";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
