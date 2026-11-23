// ============================================================================
// Chapters of a Life: brand fonts
// ============================================================================
//
// Choose the site's font here. Every heading and every paragraph on the site
// uses it, so a change here updates everything at once.
//
// To switch to a different Google Font:
//   1. Find it at fonts.google.com, e.g. "Lora".
//   2. Change the name in the `import` line below, writing spaces as
//      underscores (e.g. Playfair_Display, Source_Sans_3).
//   3. Change the name where it's used (e.g. `= Lora({`).
//   4. Keep `variable:` exactly as it is. That's how the rest of the site
//      finds the font.
// Colours and sizes live in src/theme/theme.css.

import { Literata } from "next/font/google";

// Literata: used for the logo, headings and body text. It was designed for
// comfortable reading on screens, including phones.
const brandFont = Literata({
  variable: "--font-brand",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

/** Add to the <html> tag so the whole site can use the font. */
export const fontVariables = brandFont.variable;

/**
 * The colour some phones show around the browser's address bar.
 * Keep it the same as --color-background in src/theme/theme.css.
 */
export const browserBarColour = "#f8f6f1";
