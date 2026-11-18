// The organiser's book preview: chaptersofalife.co.uk/my-books/<book id>/preview
// Row Level Security means only the book's organiser finds the order and its
// previews; the PDF itself is shown with a private link that expires in an hour.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { approvePreview, requestPreviewChanges } from "@/app/my-books/preview-actions";
import PreviewResponse from "@/components/books/PreviewResponse";
import { isBookId } from "@/lib/books";
import { orderStatusLabels, type OrderStatus } from "@/lib/orders";
import { signedPreviewUrl } from "@/lib/previews";
import { createClient } from "@/lib/supabase/server";
import styles from "../../books.module.css";

export const metadata: Metadata = {
  title: "Your preview",
  robots: { index: false },
  referrer: "no-referrer",
};

export default function PreviewPage({ params }: PageProps<"/my-books/[id]/preview">) {
  return (
    <main className="section">
      <div className="container">
        <Suspense fallback={<p className="muted">Loading your preview…</p>}>
          {params.then(({ id }) => (
            <Preview id={id} />
          ))}
        </Suspense>
      </div>
    </main>
  );
}

async function Preview({ id }: { id: string }) {
  await connection();
  if (!isBookId(id)) notFound();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  // The newest order for this book that has a preview.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, book_name, order_previews(id, version, file_path, response, response_message, uploaded_at)")
    .eq("book_id", id)
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        status: OrderStatus;
        book_name: string;
        order_previews: { id: string; version: number; file_path: string; response: string | null; response_message: string | null; uploaded_at: string }[];
      }[]
    >();
  const order = (orders ?? []).find((o) => o.order_previews.length > 0);
  const preview = order?.order_previews.sort((a, b) => b.version - a.version)[0];

  const back = (
    <p className={styles.back}>
      <Link href={`/my-books/${id}`}>← Back to the book</Link>
    </p>
  );

  if (!order || !preview) {
    return (
      <>
        {back}
        <div className="reading">
          <h1>Your preview</h1>
          <p className={styles.lead}>
            Your preview isn&rsquo;t ready yet. We&rsquo;ll email you as soon as it is.
          </p>
        </div>
      </>
    );
  }

  const url = await signedPreviewUrl(preview.file_path);
  const downloadUrl = await signedPreviewUrl(preview.file_path, `${order.book_name} - preview v${preview.version}.pdf`);
  const waiting = order.status === "preview_sent" && !preview.response;

  return (
    <>
      {back}
      <header className={styles.bookHeader}>
        <h1>Your preview</h1>
        <p className={styles.lead}>
          {order.book_name}&rsquo;s book{preview.version > 1 ? `: version ${preview.version}` : ""}
        </p>
      </header>

      {order.status === "approved" || ["sent_to_printer", "dispatched", "delivered"].includes(order.status) ? (
        <div className="thank-you preview-status" role="status">
          <h2>Thank you for approving your book</h2>
          <p>
            We&rsquo;ll now print and bind {order.book_name}&rsquo;s book with care, and email you when
            it&rsquo;s on its way. Current status: <strong>{orderStatusLabels[order.status]}</strong>.
          </p>
        </div>
      ) : order.status === "changes_requested" ? (
        <div className="thank-you preview-status" role="status">
          <h2>Thank you, we&rsquo;re making your changes</h2>
          <p>We&rsquo;ll email you as soon as the updated preview is ready.</p>
          {preview.response_message && <blockquote className="review-sayings">{preview.response_message}</blockquote>}
        </div>
      ) : (
        <p className="muted">
          Please take your time. Check names, dates, spellings and photographs. Nothing is printed until
          you approve it.
        </p>
      )}

      <div className="preview-viewer">
        <div className="actions">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="button button-secondary">
              Open the preview (PDF)
            </a>
          )}
          {downloadUrl && (
            <a href={downloadUrl} className="link-button">
              Download a copy
            </a>
          )}
        </div>
        {url ? (
          <object data={url} type="application/pdf" className="preview-frame" aria-label="Book preview">
            <p className="muted">Your browser can&rsquo;t show the preview here. Please use &ldquo;Open the preview&rdquo; above.</p>
          </object>
        ) : (
          <p className="form-error">Sorry, the preview couldn&rsquo;t be loaded. Please refresh the page.</p>
        )}
      </div>

      {waiting && (
        <section className={styles.section} aria-labelledby="respond-heading">
          <h2 id="respond-heading">Are you happy with it?</h2>
          <PreviewResponse
            approve={approvePreview.bind(null, order.id)}
            requestChanges={requestPreviewChanges.bind(null, order.id)}
          />
        </section>
      )}
    </>
  );
}
