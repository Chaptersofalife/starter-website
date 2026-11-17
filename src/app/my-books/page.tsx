// The "My books" page: chaptersofalife...com/my-books
// Only signed-in organisers can see it. Row Level Security in Supabase
// makes sure each organiser only ever gets their own profile and books.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logOut } from "@/app/auth/actions";
import { lifeDates, type Book } from "@/lib/books";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "My books",
  robots: { index: false },
};

const statusMessages: Record<string, string> = {
  created: "Your book has been started.",
  deleted: "The book has been deleted.",
};

export default function MyBooksPage({ searchParams }: PageProps<"/my-books">) {
  return (
    <main className="section">
      <div className="container">
        <Suspense fallback={<p className="muted">Loading your books…</p>}>
          {searchParams.then((query) => (
            <MyBooks status={String(query.status ?? "")} />
          ))}
        </Suspense>
      </div>
    </main>
  );
}

// Loads when the page is opened, because it's different for each organiser.
async function MyBooks({ status }: { status: string }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: books }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("books")
      .select("id, full_name, known_as, date_of_birth, date_of_death")
      .order("created_at", { ascending: false })
      .returns<Pick<Book, "id" | "full_name" | "known_as" | "date_of_birth" | "date_of_death">[]>(),
  ]);

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? "";
  const firstName = String(fullName).trim().split(/\s+/)[0];
  const message = statusMessages[status];

  return (
    <>
      {message && (
        <p className={styles.notice} role="status">
          {message}
        </p>
      )}

      <header className={styles.header}>
        <div className="reading">
          <h1>{firstName ? `Welcome, ${firstName}` : "Welcome"}</h1>
          <p className={styles.lead}>
            This is where the books you start will be kept. Take your time:
            you can come back whenever you&rsquo;re ready.
          </p>
        </div>
        <form action={logOut}>
          <button type="submit" className="button button-secondary">
            Log out
          </button>
        </form>
      </header>

      <section className={styles.books} aria-labelledby="my-books-heading">
        <div className={styles.booksHeader}>
          <h2 id="my-books-heading">My books</h2>
          {books && books.length > 0 && (
            <Link href="/my-books/new" className="button">
              Start a new book
            </Link>
          )}
        </div>

        {books && books.length > 0 ? (
          <ul className={styles.list}>
            {books.map((book) => (
              <li key={book.id}>
                <Link href={`/my-books/${book.id}`} className={styles.book}>
                  <span className={styles.bookName}>{book.full_name}</span>
                  {book.known_as && (
                    <span className={styles.bookKnownAs}>Known as {book.known_as}</span>
                  )}
                  <span className={styles.bookDates}>{lifeDates(book)}</span>
                  <span className={styles.bookOpen} aria-hidden="true">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>You haven&rsquo;t started a book yet.</p>
            <p className="muted">
              When you&rsquo;re ready, start a book with your loved one&rsquo;s
              name and their dates. You can add everything else later.
            </p>
            <div className="actions">
              <Link href="/my-books/new" className="button">
                Start a new book
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
