"use client";

// The menu in the header. To add a page to the menu, add a line to `links`.
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/contact", label: "Contact" },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main menu" className="site-nav">
      <ul>
        {links.map((link) => (
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
