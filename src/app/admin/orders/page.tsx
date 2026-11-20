// Admin: all orders, newest first: chaptersofalife.co.uk/admin/orders
// Only admins can open it; everyone else sees "page not found".
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminPreparePreviewUpload, adminPublishPreview, adminSetOrderStatus } from "@/app/admin/actions";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import PreviewUpload from "@/components/admin/PreviewUpload";
import { requireAdmin } from "@/lib/admin";
import { orderReference } from "@/lib/order-payments";
import { addressLines, formatPounds, paidStatuses, previewableStatuses, type OrderStatus } from "@/lib/orders";
import { signedPreviewUrl } from "@/lib/previews";
import { stripeTestMode } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase/admin";
import styles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Admin: orders",
  robots: { index: false, follow: false },
};

type Order = {
  id: string;
  book_id: string | null;
  book_name: string;
  organiser_email: string;
  extra_copies: number;
  total_copies: number;
  page_count: number;
  delivery_pence: number;
  amount_pence: number;
  delivery_name: string;
  address_line1: string;
  address_line2: string | null;
  town: string;
  county: string | null;
  postcode: string;
  phone: string | null;
  status: OrderStatus;
  paid_at: string | null;
  created_at: string;
  tracking_number: string | null;
  tracking_url: string | null;
};

type PreviewRow = {
  id: string;
  order_id: string;
  version: number;
  file_path: string;
  file_name: string | null;
  uploaded_at: string;
  response: string | null;
  response_message: string | null;
  responded_at: string | null;
};

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <main className="section">
      <div className="container">
        <p className={styles.back}>
          <Link href="/admin">← All books</Link>
        </p>
        <Suspense fallback={<p className="muted">Loading…</p>}>
          {searchParams.then((q) => (
            <Orders showAll={q.show === "all"} />
          ))}
        </Suspense>
      </div>
    </main>
  );
}

async function Orders({ showAll }: { showAll: boolean }) {
  await requireAdmin();
  const admin = getAdminClient();
  if (!admin) return <p className="form-error">SUPABASE_SECRET_KEY is missing.</p>;

  let query = admin.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
  if (!showAll) query = query.in("status", paidStatuses);
  const { data, error } = await query.returns<Order[]>();
  const orders = data ?? [];
  // Every preview version, newest first, with a one-hour viewing link.
  const { data: previewRows } = orders.length
    ? await admin
        .from("order_previews")
        .select("id, order_id, version, file_path, file_name, uploaded_at, response, response_message, responded_at")
        .in("order_id", orders.map((o) => o.id))
        .order("version", { ascending: false })
        .returns<PreviewRow[]>()
    : { data: [] as PreviewRow[] };
  const previews = await Promise.all(
    (previewRows ?? []).map(async (p) => ({ ...p, url: await signedPreviewUrl(p.file_path) })),
  );
  const previewsFor = (orderId: string) => previews.filter((p) => p.order_id === orderId);

  const paidTotal = orders.filter((o) => paidStatuses.includes(o.status) && o.status !== "refunded").reduce((n, o) => n + o.amount_pence, 0);

  return (
    <>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Admin</p>
        <h1>Orders</h1>
        {stripeTestMode() && <p className="photo-warning">Stripe is in test mode: these are test payments, no real money.</p>}
      </header>

      <p className="muted">
        {showAll ? (
          <>
            Showing all orders, including ones that weren&rsquo;t paid. <Link href="/admin/orders">Show paid orders only</Link>
          </>
        ) : (
          <>
            Showing paid orders ({orders.length}, {formatPounds(paidTotal)} excluding refunds).{" "}
            <Link href="/admin/orders?show=all">Include unpaid and abandoned checkouts</Link>
          </>
        )}
      </p>

      {error && (
        <p className="form-error" role="alert">
          Sorry, the orders couldn&rsquo;t be loaded.
        </p>
      )}

      {orders.length === 0 ? (
        <p className="muted">No orders yet.</p>
      ) : (
        <ol className={styles.memories}>
          {orders.map((o) => (
            <li key={o.id} className="review-card">
              <header className="review-header">
                <div className="review-who">
                  <p className="review-name">
                    {o.book_id ? <Link href={`/admin/books/${o.book_id}`}>{o.book_name}</Link> : o.book_name}
                  </p>
                  <p className="review-meta">
                    {orderReference(o.id)} · {formatDay(o.paid_at ?? o.created_at)} ·{" "}
                    <a href={`mailto:${o.organiser_email}`}>{o.organiser_email}</a>
                  </p>
                </div>
                <OrderStatusSelect
                  orderId={o.id}
                  status={o.status}
                  trackingNumber={o.tracking_number}
                  trackingUrl={o.tracking_url}
                  setStatus={adminSetOrderStatus}
                />
              </header>
              <dl className={styles.facts}>
                <div>
                  <dt>Book</dt>
                  <dd>
                    {o.page_count} pages · {o.total_copies} {o.total_copies === 1 ? "copy" : "copies"}
                    {o.extra_copies > 0 ? ` (1 + ${o.extra_copies} extra)` : ""}
                    <span className="address-line">
                      {formatPounds(o.amount_pence)} paid, including {formatPounds(o.delivery_pence)} UK tracked delivery
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Deliver to</dt>
                  <dd>
                    {addressLines(o).map((line) => (
                      <span key={line} className="address-line">
                        {line}
                      </span>
                    ))}
                    {o.phone && <span className="address-line">Phone: {o.phone}</span>}
                  </dd>
                </div>
                {(o.tracking_number || o.tracking_url) && (
                  <div>
                    <dt>Tracking</dt>
                    <dd>
                      {o.tracking_number}
                      {o.tracking_url && (
                        <>
                          {o.tracking_number ? " · " : ""}
                          <a href={o.tracking_url} target="_blank" rel="noopener noreferrer">
                            Tracking link
                          </a>
                        </>
                      )}
                    </dd>
                  </div>
                )}
              </dl>

              {paidStatuses.includes(o.status) && (
                <div className="order-previews">
                  <p className="review-sayings-label">Previews</p>
                  {previewsFor(o.id).length === 0 ? (
                    <p className="muted">No preview sent yet.</p>
                  ) : (
                    <ul className="preview-versions">
                      {previewsFor(o.id).map((p) => (
                        <li key={p.id}>
                          <span>
                            <strong>Version {p.version}</strong> · sent {formatDay(p.uploaded_at)}
                            {p.url && (
                              <>
                                {" · "}
                                <a href={p.url} target="_blank" rel="noopener noreferrer">
                                  View PDF
                                </a>
                              </>
                            )}
                          </span>
                          {p.response === "approved" && <span className="open-label">Approved {p.responded_at ? formatDay(p.responded_at) : ""}</span>}
                          {p.response === "changes_requested" && (
                            <span className="preview-changes">
                              <span className="closed-label">Changes requested</span>
                              {p.response_message && <span className="review-text">{p.response_message}</span>}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {previewableStatuses.includes(o.status) && (
                    <PreviewUpload
                      orderId={o.id}
                      nextVersion={(previewsFor(o.id)[0]?.version ?? 0) + 1}
                      prepare={adminPreparePreviewUpload.bind(null, o.id)}
                      publish={adminPublishPreview.bind(null, o.id)}
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function formatDay(timestamp: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(timestamp));
}
