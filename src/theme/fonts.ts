// ============================================================================
// Chapters of a Life: brand fonts
// ============================================================================
//
// Choose the site's two fonts here. Every heading and every paragraph on the
// site uses them, so a change here updates everything at once.
//
// To switch to a different Google Font:
//   1. Find it at fonts.google.com, e.g. "Lora".
//   2. Change the name in the `import` line below, writing spaces as
//      underscores (e.g. Playfair_Display, Source_Sans_3).
//   3. Change the name where it's used (e.g. `= Lora({`).
//   4. Keep `variable:` exactly as it is. That's how the rest of the site
//      finds the font.
// Colours and sizes live in src/theme/theme.css.

import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";

// Elegant font for headings
const headingFont = Cormorant_Garamond({
  variable: "--font-brand-heading",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

// Clear, easy-to-read font for body text
const bodyFont = Source_Sans_3({
  variable: "--font-brand-body",
  subsets: ["latin"],
});

/** Add to the <html> tag so the whole site can use the fonts. */
export const fontVariables = `${headingFont.variable} ${bodyFont.variable}`;

/**
 * The colour some phones show around the browser's address bar.
 * Keep it the same as --color-ivory in src/theme/theme.css.
 */
export const browserBarColour = "#faf6f0";
