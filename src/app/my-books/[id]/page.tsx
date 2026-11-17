// One book: chaptersofalife...com/my-books/<book id>
// Row Level Security means an organiser can only ever load their own books.
// Anyone else's book simply isn't found.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { deleteBook } from "@/app/my-books/actions";
import DeleteBook from "@/components/books/DeleteBook";
import { bookColumns, formatDate, isBookId, type Book } from "@/lib/books";
import { createClient } from "@/lib/supabase/server";
import styles from "../books.module.css";

export const metadata: Metadata = {
  title: "Book",
  robots: { index: false },
};

export default function BookPage({ params, searchParams }: PageProps<"/my-books/[id]">) {
  return (
    <main className="section">
      <div className="container">
        <p className={styles.back}>
          <Link href="/my-books">← My books</Link>
        </p>
        <Suspense fallback={<p className="muted">Loading the book…</p>}>
          {Promise.all([params, searchParams]).then(([{ id }, query]) => (
            <BookDetails id={id} status={String(query.status ?? "")} />
          ))}
        </Suspense>
      </div>
    </main>
  );
}

async function BookDetails({ id, status }: { id: string; status: string }) {
  if (!isBookId(id)) notFound();

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: book } = await supabase
    .from("books")
    .select(bookColumns)
    .eq("id", id)
    .maybeSingle<Book>();
  if (!book) notFound();

  return (
    <article className={styles.book}>
      {status === "saved" && (
        <p className={styles.notice} role="status">
          Your changes have been saved.
        </p>
      )}
      {status === "delete-failed" && (
        <p className="form-error" role="alert">
          Sorry, we couldn&rsquo;t delete the book just now. Please try again.
        </p>
      )}

      <header className={styles.bookHeader}>
        <h1>{book.full_name}</h1>
        {book.known_as && <p className={styles.knownAs}>Known as {book.known_as}</p>}
        <hr className="ornament" />
      </header>

      <dl className={styles.details}>
        <div>
          <dt>Born</dt>
          <dd>{formatDate(book.date_of_birth) || "Not added yet"}</dd>
        </div>
        <div>
          <dt>Died</dt>
          <dd>{formatDate(book.date_of_death) || "Not added yet"}</dd>
        </div>
        {book.lived_in && (
          <div>
            <dt>Lived in</dt>
            <dd>{book.lived_in}</dd>
          </div>
        )}
      </dl>

      <section className={styles.introduction} aria-labelledby="intro-heading">
        <h2 id="intro-heading">Introduction</h2>
        {book.introduction ? (
          <p className={styles.introText}>{book.introduction}</p>
        ) : (
          <p className="muted">
            No introduction yet. You can add a few words about them by editing
            the details.
          </p>
        )}
      </section>

      <div className={styles.bookActions}>
        <Link href={`/my-books/${book.id}/edit`} className="button">
          Edit details
        </Link>
        <DeleteBook action={deleteBook.bind(null, book.id)} bookName={book.full_name} />
      </div>
    </article>
  );
}
