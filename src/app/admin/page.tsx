// The admin area: chaptersofalife...com/admin
// Only admins can open it. Everyone else sees "page not found". This is
// checked on the server (in src/proxy.ts and again here), not just by hiding
// the menu link.
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminRunReminders } from "@/app/admin/actions";
import { RunRemindersButton } from "@/components/admin/ReminderControls";
import { requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/books";
import { getAdminClient } from "@/lib/supabase/admin";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

type Row = {
  book_id: string;
  full_name: string;
  known_as: string | null;
  created_at: string;
  organiser_name: string | null;
  organiser_email: string | null;
  memories_waiting: number;
  memories_approved: number;
  memories_hidden: number;
  photos: number;
  closes_on: string | null;
  closed_at: string | null;
  is_open: boolean;
};

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="section">
      <div className="container">
        <Suspense fallback={<p className="muted">Loading…</p>}>
          {searchParams.then((query) => (
            <AdminHome q={String(query.q ?? "").trim()} />
          ))}
        </Suspense>
      </div>
    </main>
  );
}

async function AdminHome({ q }: { q: string }) {
  await requireAdmin();

  const admin = getAdminClient();
  if (!admin) {
    return (
      <p className="form-error" role="alert">
        The admin area needs SUPABASE_SECRET_KEY. Please add it to .env.local and Netlify.
      </p>
    );
  }
  const { data, error } = await admin.rpc("admin_book_overview");
  if (error) console.error("admin_book_overview failed:", error.code, error.message);
  const rows = (data ?? []) as Row[];

  const totals = {
    books: rows.length,
    memories: rows.reduce((n, r) => n + r.memories_waiting + r.memories_approved + r.memories_hidden, 0),
    photos: rows.reduce((n, r) => n + r.photos, 0),
  };

  const needle = q.toLowerCase();
  const shown = needle
    ? rows.filter((r) =>
        [r.full_name, r.known_as, r.organiser_name, r.organiser_email].some((v) =>
          (v ?? "").toLowerCase().includes(needle),
        ),
      )
    : rows;

  return (
    <>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Admin</p>
        <h1>All books</h1>
      </header>

      {error && (
        <p className="form-error" role="alert">
          Sorry, the books couldn&rsquo;t be loaded. Please refresh the page.
        </p>
      )}

      <dl className={styles.totals}>
        <div>
          <dt>Books</dt>
          <dd>{totals.books}</dd>
        </div>
        <div>
          <dt>Memories</dt>
          <dd>{totals.memories}</dd>
        </div>
        <div>
          <dt>Photos</dt>
          <dd>{totals.photos}</dd>
        </div>
      </dl>

      <section className={styles.panel} aria-labelledby="reminders-heading">
        <h2 id="reminders-heading">Reminder emails</h2>
        <p className="muted">
          Reminders are sent automatically every morning. To see sample emails for a book, open
          it and use &ldquo;Email me a sample of every email&rdquo;.
        </p>
        <RunRemindersButton run={adminRunReminders} />
      </section>

      <form action="/admin" method="get" className={styles.search} role="search">
        <label htmlFor="admin-search" className="visually-hidden">
          Search books
        </label>
        <input
          id="admin-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by person, organiser name or email"
        />
        <button type="submit" className="button">
          Search
        </button>
        {q && (
          <Link href="/admin" className="button button-secondary">
            Clear
          </Link>
        )}
      </form>

      {q && (
        <p className="muted" role="status">
          {shown.length} {shown.length === 1 ? "book matches" : "books match"} &ldquo;{q}&rdquo;
        </p>
      )}

      {shown.length === 0 ? (
        <p className="muted">{q ? "No books match your search." : "No books have been created yet."}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Organiser</th>
                <th scope="col">Created</th>
                <th scope="col" className={styles.num}>
                  Waiting
                </th>
                <th scope="col" className={styles.num}>
                  Approved
                </th>
                <th scope="col" className={styles.num}>
                  Hidden
                </th>
                <th scope="col" className={styles.num}>
                  Photos
                </th>
                <th scope="col">Closing</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.book_id}>
                  <td>
                    <Link href={`/admin/books/${r.book_id}`} className={styles.bookLink}>
                      {r.full_name}
                    </Link>
                    {r.known_as && <span className={styles.sub}>Known as {r.known_as}</span>}
                  </td>
                  <td>
                    {r.organiser_name || "No name"}
                    {r.organiser_email && (
                      <span className={styles.sub}>
                        <a href={`mailto:${r.organiser_email}`}>{r.organiser_email}</a>
                      </span>
                    )}
                  </td>
                  <td className={styles.nowrap}>{formatDay(r.created_at)}</td>
                  <td className={styles.num}>{r.memories_waiting}</td>
                  <td className={styles.num}>{r.memories_approved}</td>
                  <td className={styles.num}>{r.memories_hidden}</td>
                  <td className={styles.num}>{r.photos}</td>
                  <td>
                    <span className={r.is_open ? "open-label" : "closed-label"}>{r.is_open ? "Open" : "Closed"}</span>
                    <span className={styles.sub}>
                      {r.closed_at
                        ? `Closed early ${formatDay(r.closed_at)}`
                        : r.closes_on
                          ? `${r.is_open ? "Until" : "Closed"} ${formatDate(r.closes_on)}`
                          : "No closing date"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function formatDay(timestamp: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(timestamp));
}
