// The "My books" page: chaptersofalife...com/my-books
// Only signed-in organisers can see it. Row Level Security in Supabase
// makes sure each organiser only ever gets their own profile and books.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logOut } from "@/app/auth/actions";
import StartBookButton from "@/components/StartBookButton";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "My books",
  robots: { index: false },
};

export default function MyBooksPage() {
  return (
    <main className="section">
      <div className="container">
        <Suspense fallback={<p className="muted">Loading your books…</p>}>
          <MyBooks />
        </Suspense>
      </div>
    </main>
  );
}

// Loads when the page is opened, because it's different for each organiser.
async function MyBooks() {
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
      .select("id, loved_one_name, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? "";
  const firstName = String(fullName).trim().split(/\s+/)[0];

  return (
    <>
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
        <h2 id="my-books-heading">My books</h2>

        {books && books.length > 0 ? (
          <ul className={styles.list}>
            {books.map((book) => (
              <li key={book.id} className={styles.book}>
                {book.loved_one_name}
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>You haven&rsquo;t started a book yet.</p>
            <p className="muted">
              When you&rsquo;re ready, start a book with your loved one&rsquo;s
              name, their dates and a favourite photograph.
            </p>
            <div className="actions">
              <StartBookButton />
            </div>
          </div>
        )}
      </section>
    </>
  );
}
