// "Order your book": chaptersofalife.co.uk/my-books/<book id>/order
// Only for the book's organiser, and only once the book is closed.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { startCheckout } from "@/app/my-books/order-actions";
import OrderForm from "@/components/books/OrderForm";
import { isBookId } from "@/lib/books";
import { isOpen } from "@/lib/closing";
import { BOOK_PRICE_PENCE, EXTRA_COPY_PENCE, PREVIEW_WORKING_DAYS, formatPounds } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import styles from "../../books.module.css";

export const metadata: Metadata = {
  title: "Order your book",
  robots: { index: false },
};

export default function OrderPage({ params, searchParams }: PageProps<"/my-books/[id]/order">) {
  return (
    <main className="section">
      <div className="container">
        <Suspense fallback={<p className="muted">Loading…</p>}>
          {Promise.all([params, searchParams]).then(([{ id }, q]) => (
            <Order id={id} cancelled={q.cancelled === "1"} />
          ))}
        </Suspense>
      </div>
    </main>
  );
}

async function Order({ id, cancelled }: { id: string; cancelled: boolean }) {
  await connection(); // uses today's date (is the book closed?)
  if (!isBookId(id)) notFound();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const [{ data: book }, { data: profile }] = await Promise.all([
    supabase.from("books").select("id, full_name, closes_on, closed_at").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!book) notFound();
  const open = isOpen({ closesOn: book.closes_on, closedAt: book.closed_at });

  return (
    <>
      <p className={styles.back}>
        <Link href={`/my-books/${book.id}`}>← Back to the book</Link>
      </p>
      <div className={styles.formLayout}>
        <div className="reading">
          <h1>Order your book</h1>
          <p className={styles.lead}>A keepsake book of memories for {book.full_name}.</p>

          <div className="order-product">
            <h2>Keepsake book</h2>
            <ul>
              <li>32 pages, A4, hardback</li>
              <li>The memories and photographs you approved, designed with care</li>
              <li>A preview to look through within {PREVIEW_WORKING_DAYS} working days. Nothing is printed until you approve it</li>
              <li>UK delivery included</li>
            </ul>
            <p className="order-price">
              {formatPounds(BOOK_PRICE_PENCE)} <span>· extra copies {formatPounds(EXTRA_COPY_PENCE)} each</span>
            </p>
          </div>

          {cancelled && (
            <p className={styles.notice} role="status">
              Payment cancelled. Nothing has been taken. You can try again whenever you&rsquo;re ready.
            </p>
          )}
        </div>

        <div className={styles.formPanel}>
          {open ? (
            <div className="form">
              <p>
                You can order once the book has closed to new memories, so everyone&rsquo;s memories
                are included.
              </p>
              <div>
                <Link href={`/my-books/${book.id}`} className="button button-secondary">
                  Back to the book
                </Link>
              </div>
            </div>
          ) : (
            <OrderForm action={startCheckout.bind(null, book.id)} defaultName={profile?.full_name ?? ""} />
          )}
        </div>
      </div>
    </>
  );
}
