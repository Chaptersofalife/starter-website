// "Start a new book": chaptersofalife...com/my-books/new
import type { Metadata } from "next";
import Link from "next/link";
import { createBook } from "@/app/my-books/actions";
import BookForm from "@/components/books/BookForm";
import styles from "../books.module.css";

export const metadata: Metadata = {
  title: "Start a new book",
  robots: { index: false },
};

export default function NewBookPage() {
  return (
    <main className="section">
      <div className="container">
        <p className={styles.back}>
          <Link href="/my-books">← My books</Link>
        </p>
        <div className={styles.formLayout}>
          <div className="reading">
            <h1>Start a new book</h1>
            <p className={styles.lead}>
              Begin with a few details about the person you&rsquo;re
              remembering. Only the name and dates are needed now. You can add
              or change anything later, and add a cover photograph in a later
              step.
            </p>
          </div>
          <div className={styles.formPanel}>
            <BookForm
              action={createBook}
              submitLabel="Save and start the book"
              pendingLabel="Saving…"
              cancelHref="/my-books"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
