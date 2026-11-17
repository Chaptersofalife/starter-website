// ============================================================================
// Chapters of a Life: logo
// ============================================================================
//
// The logo shown at the top of every page, linking to the home page.
// For now it's the business name in the heading font.
//
// To use an image logo later:
//   1. Put the file in the `public` folder, e.g. public/logo.svg
//   2. Replace the `<span>` below with:
//        <img src="/logo.svg" alt="Chapters of a Life" width={200} height={40} />
//      (use your logo's real width and height)
// Its styles are `.logo` in src/app/globals.css.

import Link from "next/link";
import { businessName } from "@/lib/site";

export default function Logo() {
  return (
    <Link href="/" className="logo" aria-label={`${businessName}: home`}>
      <span className="logo-text">{businessName}</span>
    </Link>
  );
}
