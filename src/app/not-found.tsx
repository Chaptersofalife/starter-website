// Shown when a page doesn't exist, or a book isn't found
// (for example, it was deleted, or it belongs to someone else).
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="section">
      <div className="container">
        <div className="reading">
          <h1>We couldn&rsquo;t find that page</h1>
          <p className="muted" style={{ marginTop: "1rem" }}>
            It may have moved, or a book may have been deleted. If you
            followed a link to a book, please check you&rsquo;re logged in to
            the right account.
          </p>
          <div className="actions">
            <Link href="/my-books" className="button">
              Go to My books
            </Link>
            <Link href="/" className="button button-secondary">
              Go to the home page
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
