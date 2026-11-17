"use client";

// The menu in the header. To add a page to the menu, add a line to `links`.
// The last item shows "Log in" to visitors and "My books" to signed-in organisers.
// "Admin" appears only for admins. (That's just for convenience: the admin
// pages themselves check on the server, so hiding the link isn't the protection.)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/contact", label: "Contact" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // Bumped when the sign-in changes in this browser tab, to check again.
  const [authChanges, setAuthChanges] = useState(0);

  // Check again on every page change. Logging in or out moves to a new page
  // without reloading, so the menu (which stays in place) must look again.
  useEffect(() => {
    let current = true;
    (async () => {
      const supabase = createClient();
      // A quick look in this browser first: visitors who aren't signed in
      // don't need to ask the server anything.
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (current) {
          setSignedIn(false);
          setIsAdmin(false);
        }
        return;
      }
      // Ask the server, which uses the same checks as the private pages.
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        const status = (await response.json()) as { signedIn: boolean; isAdmin: boolean };
        if (current) {
          setSignedIn(status.signedIn);
          setIsAdmin(status.isAdmin);
        }
      } catch {
        if (current) setSignedIn(true); // keep "My books"; try again on the next page
      }
    })();
    return () => {
      current = false;
    };
  }, [pathname, authChanges]);

  // Sign-in changes made in this tab (for example a session ending).
  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        // Run after the sign-in change has finished, as Supabase recommends.
        setTimeout(() => setAuthChanges((n) => n + 1), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SiteNavLinks pathname={pathname} signedIn={signedIn} isAdmin={isAdmin} />;
}

/**
 * The menu itself. Also shown for a moment on pages whose address is only
 * known when someone opens them (like a book), until SiteNav takes over.
 */
export function SiteNavLinks({
  pathname = null,
  signedIn = false,
  isAdmin = false,
}: {
  pathname?: string | null;
  signedIn?: boolean;
  isAdmin?: boolean;
}) {
  const accountLink = signedIn
    ? { href: "/my-books", label: "My books" }
    : { href: "/login", label: "Log in" };

  return (
    <nav aria-label="Main menu" className="site-nav">
      <ul>
        {[...links, accountLink, ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : [])].map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              // Tells screen readers (and the styles) which page you're on
              aria-current={
                pathname === link.href || (link.href === "/admin" && pathname?.startsWith("/admin/"))
                  ? "page"
                  : undefined
              }
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
