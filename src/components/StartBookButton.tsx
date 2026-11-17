// The "Start a book" button, used on several pages.
// It opens the "Start a new book" form. Visitors who aren't logged in are
// asked to log in (or create an account) first.
import Link from "next/link";

export default function StartBookButton() {
  return (
    <Link href="/my-books/new" className="button">
      Start a book
    </Link>
  );
}
