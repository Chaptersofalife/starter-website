// Reads the Supabase settings from environment variables:
// .env.local on your computer, and Netlify's environment variables on the live site.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Supabase is not set up. Add NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local (on your computer) " +
      "or to Netlify's environment variables (for the live site).",
  );
}

export const supabaseUrl = url;
export const supabaseKey = key;
