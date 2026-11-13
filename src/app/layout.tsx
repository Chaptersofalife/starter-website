// The frame around every page: fonts, header and footer.
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

// Elegant font for headings
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

// Clear, easy-to-read font for body text
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Each page's own title is shown first, e.g. "How it works · Chapters of a Life"
  title: {
    default: "Chapters of a Life",
    template: "%s · Chapters of a Life",
  },
  description: "Personalised memorial books.",
};

export const viewport: Viewport = {
  themeColor: "#faf6f0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${cormorant.variable} ${sourceSans.variable}`}>
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="site-name">
              Chapters of a Life
            </Link>
            <SiteNav />
          </div>
        </header>

        {children}

        <footer className="site-footer">
          <div className="container">
            <p>© Chapters of a Life</p>
            <nav aria-label="Legal" className="footer-nav">
              <ul>
                <li>
                  <Link href="/privacy">Privacy Policy</Link>
                </li>
                <li>
                  <Link href="/terms">Terms &amp; Conditions</Link>
                </li>
              </ul>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
