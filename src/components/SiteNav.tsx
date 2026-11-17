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

  useEffect(() => {
    const supabase = createClient();
    // Only used to choose which menu link to show. Private pages check
    // properly on the server before showing anything.
    const check = async (hasSession: boolean) => {
      setSignedIn(hasSession);
      if (!hasSession) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase.rpc("is_admin");
      setIsAdmin(data === true);
    };
    supabase.auth.getSession().then(({ data }) => check(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Run after the sign-in change has finished, as Supabase recommends.
      setTimeout(() => check(Boolean(session)), 0);
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
