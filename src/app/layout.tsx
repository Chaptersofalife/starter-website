// The frame around every page: header (logo and menu) and footer.
// The look (colours, fonts, sizes) comes from src/theme/, not from here.
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import { Suspense } from "react";
import SiteNav, { SiteNavLinks } from "@/components/SiteNav";
import { businessName } from "@/lib/site";
import { browserBarColour, fontVariables } from "@/theme/fonts";
import "@/theme/theme.css";
import "./globals.css";

export const metadata: Metadata = {
  // Each page's own title is shown first, e.g. "How it works · Chapters of a Life"
  title: {
    default: businessName,
    template: `%s · ${businessName}`,
  },
  description: "Personalised memorial books.",
};

export const viewport: Viewport = {
  themeColor: browserBarColour,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <header className="site-header">
          <div className="container">
            <Logo />
            <Suspense fallback={<SiteNavLinks />}>
              <SiteNav />
            </Suspense>
          </div>
        </header>

        {children}

        <footer className="site-footer">
          <div className="container">
            <p>{`© ${businessName}`}</p>
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
