// Edit a book's details: chaptersofalife...com/my-books/<book id>/edit
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { updateBook } from "@/app/my-books/actions";
import BookForm from "@/components/books/BookForm";
import { bookColumns, isBookId, type Book } from "@/lib/books";
import { createClient } from "@/lib/supabase/server";
import styles from "../../books.module.css";

export const metadata: Metadata = {
  title: "Edit details",
  robots: { index: false },
};

export default function EditBookPage({ params }: PageProps<"/my-books/[id]/edit">) {
  return (
    <main className="section">
      <div className="container">
        <Suspense fallback={<p className="muted">Loading the book…</p>}>
          {params.then(({ id }) => (
            <EditBook id={id} />
          ))}
        </Suspense>
      </div>
    </main>
  );
}

async function EditBook({ id }: { id: string }) {
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
    <>
      <p className={styles.back}>
        <Link href={`/my-books/${book.id}`}>← Back to the book</Link>
      </p>
      <div className={styles.formLayout}>
        <div className="reading">
          <h1>Edit details</h1>
          <p className={styles.lead}>Change anything you like, then save.</p>
        </div>
        <div className={styles.formPanel}>
          <BookForm
            action={updateBook.bind(null, book.id)}
            initial={{
              full_name: book.full_name,
              known_as: book.known_as ?? "",
              date_of_birth: book.date_of_birth ?? "",
              date_of_death: book.date_of_death ?? "",
              lived_in: book.lived_in ?? "",
              introduction: book.introduction ?? "",
              closes_on: book.closes_on ?? "",
            }}
            submitLabel="Save changes"
            pendingLabel="Saving…"
            cancelHref={`/my-books/${book.id}`}
          />
        </div>
      </div>
    </>
  );
}
