"use client";

// The menu in the header. To add a page to the menu, add a line to `links`.
// The last item shows "Log in" to visitors and "My books" to signed-in organisers.
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

  useEffect(() => {
    const supabase = createClient();
    // Only used to choose which menu link to show. Private pages check
    // properly on the server before showing anything.
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const accountLink = signedIn
    ? { href: "/my-books", label: "My books" }
    : { href: "/login", label: "Log in" };

  return (
    <nav aria-label="Main menu" className="site-nav">
      <ul>
        {[...links, accountLink].map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              // Tells screen readers (and the styles) which page you're on
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
