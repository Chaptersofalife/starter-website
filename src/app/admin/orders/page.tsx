// Admin: all orders, newest first: chaptersofalife.co.uk/admin/orders
// Only admins can open it; everyone else sees "page not found".
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminSetOrderStatus } from "@/app/admin/actions";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import { requireAdmin } from "@/lib/admin";
import { orderReference } from "@/lib/order-payments";
import { addressLines, formatPounds, paidStatuses, type OrderStatus } from "@/lib/orders";
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
                <OrderStatusSelect orderId={o.id} status={o.status} setStatus={adminSetOrderStatus} />
              </header>
              <dl className={styles.facts}>
                <div>
                  <dt>Copies</dt>
                  <dd>
                    {o.total_copies}
                    {o.extra_copies > 0 ? ` (1 + ${o.extra_copies} extra)` : ""} · {formatPounds(o.amount_pence)}
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
              </dl>
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
