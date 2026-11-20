// After paying: chaptersofalife.co.uk/my-books/<book id>/order/thanks
// This page only SHOWS the order's status. It never marks anything as paid:
// only Stripe's confirmation (the webhook) does that.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { isBookId } from "@/lib/books";
import { PREVIEW_WORKING_DAYS, formatPounds, paidStatuses, type OrderStatus } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import styles from "../../../books.module.css";

export const metadata: Metadata = {
  title: "Thank you for your order",
  robots: { index: false },
};

export default function ThanksPage({ params, searchParams }: PageProps<"/my-books/[id]/order/thanks">) {
  return (
    <main className="section">
      <div className="container">
        <Suspense fallback={<p className="muted">Loading…</p>}>
          {Promise.all([params, searchParams]).then(([{ id }, q]) => (
            <Thanks id={id} sessionId={String(q.session_id ?? "")} />
          ))}
        </Suspense>
      </div>
    </main>
  );
}

async function Thanks({ id, sessionId }: { id: string; sessionId: string }) {
  await connection();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  // Row Level Security: only finds the organiser's own order.
  const { data: order } =
    isBookId(id) && /^cs_[A-Za-z0-9_]+$/.test(sessionId)
      ? await supabase
          .from("orders")
          .select("status, amount_pence, total_copies, page_count, organiser_email, book_name")
          .eq("book_id", id)
          .eq("stripe_checkout_session_id", sessionId)
          .maybeSingle<{ status: OrderStatus; amount_pence: number; total_copies: number; page_count: number; organiser_email: string; book_name: string }>()
      : { data: null };

  const confirmed = order && paidStatuses.includes(order.status);

  return (
    <div className="reading">
      <h1>Thank you</h1>
      {confirmed ? (
        <p className={styles.lead}>
          Your payment of {formatPounds(order.amount_pence)} (including UK tracked delivery) has been
          received for your {order.page_count}-page book
          {order.total_copies > 1 ? ` and ${order.total_copies - 1} extra ${order.total_copies === 2 ? "copy" : "copies"}` : ""}, and
          we&rsquo;ve sent a confirmation to {order.organiser_email}.
        </p>
      ) : (
        <p className={styles.lead}>
          We&rsquo;re just confirming your payment with Stripe. This usually takes a few seconds, and
          you&rsquo;ll receive a confirmation email as soon as it&rsquo;s done.{" "}
          <Link href={`/my-books/${id}/order/thanks?session_id=${encodeURIComponent(sessionId)}`}>Refresh this page</Link>{" "}
          to check.
        </p>
      )}

      <hr className="ornament" />

      <h2>What happens next</h2>
      <ol className="next-steps">
        <li>
          We&rsquo;ll design your book and send you a preview to approve within {PREVIEW_WORKING_DAYS} working days.
        </li>
        <li>Nothing is printed until you&rsquo;re happy with it.</li>
        <li>
          Your {order && order.total_copies > 1 ? `${order.total_copies} books are` : "book is"} then printed, bound and sent
          to you by UK tracked delivery. We&rsquo;ll email you the tracking details.
        </li>
      </ol>
      <p className="muted">
        If you have any questions in the meantime, just reply to your confirmation email.
      </p>
      <div className="actions">
        <Link href={`/my-books/${id}`} className="button">
          Back to the book
        </Link>
      </div>
    </div>
  );
}
