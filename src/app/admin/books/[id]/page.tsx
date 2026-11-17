// One book in the admin area (read-only): chaptersofalife...com/admin/books/<id>
// Only admins can open it; everyone else sees "page not found".
import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { adminDownloadUrl, adminSendTestEmails, getLayoutPackage } from "@/app/admin/actions";
import LayoutDownload from "@/components/admin/LayoutDownload";
import { TestEmailsButton } from "@/components/admin/ReminderControls";
import PhotoGallery, { type GalleryPhoto } from "@/components/books/PhotoGallery";
import { requireAdmin } from "@/lib/admin";
import { formatDate, isBookId, todayInUK } from "@/lib/books";
import { daysLeftText, isOpen } from "@/lib/closing";
import { printWarning } from "@/lib/photos";
import { signedViewUrls } from "@/lib/photos-server";
import { getAdminClient } from "@/lib/supabase/admin";
import styles from "../../admin.module.css";

export const metadata: Metadata = {
  title: "Admin: book",
  robots: { index: false, follow: false },
};

const statusLabels: Record<string, string> = {
  waiting: "Waiting for review",
  approved: "Approved",
  hidden: "Hidden",
};

export default function AdminBookPage({ params }: PageProps<"/admin/books/[id]">) {
  return (
    <main className="section">
      <div className="container">
        <p className={styles.back}>
          <Link href="/admin">← All books</Link>
        </p>
        <Suspense fallback={<p className="muted">Loading…</p>}>
          {params.then(({ id }) => (
            <AdminBook id={id} />
          ))}
        </Suspense>
      </div>
    </main>
  );
}

async function AdminBook({ id }: { id: string }) {
  await connection(); // uses today's date (closing date)
  await requireAdmin();
  if (!isBookId(id)) notFound();
  const admin = getAdminClient();
  if (!admin) notFound();

  const [{ data: book }, { data: overview }, { data: memories }, { data: photos }] = await Promise.all([
    admin
      .from("books")
      .select(
        "id, full_name, known_as, date_of_birth, date_of_death, lived_in, introduction, created_at, cover_display_path, cover_width, cover_height, closes_on, closed_at",
      )
      .eq("id", id)
      .maybeSingle(),
    admin.rpc("admin_book_overview"),
    admin
      .from("memories")
      .select(
        "id, contributor_name, contributor_email, relationship, memory, sayings, edited_memory, edited_sayings, status, created_at",
      )
      .eq("book_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("memory_photos")
      .select("id, memory_id, position, display_path, thumb_path, caption, taken_text, width, height, hidden")
      .eq("book_id", id)
      .eq("uploaded", true)
      .order("position"),
  ]);
  if (!book) notFound();

  const info = ((overview ?? []) as { book_id: string; organiser_name: string | null; organiser_email: string | null }[]).find(
    (r) => r.book_id === id,
  );
  const allMemories = memories ?? [];
  const allPhotos = photos ?? [];
  const count = (s: string) => allMemories.filter((m) => m.status === s).length;

  const urls = await signedViewUrls([
    book.cover_display_path,
    ...allPhotos.flatMap((p) => [p.thumb_path, p.display_path]),
  ]);
  const photosByMemory = new Map<string, GalleryPhoto[]>();
  for (const p of allPhotos) {
    const list = photosByMemory.get(p.memory_id) ?? [];
    list.push({
      id: p.id,
      thumbUrl: urls.get(p.thumb_path) ?? null,
      displayUrl: urls.get(p.display_path) ?? null,
      caption: p.caption,
      taken: p.taken_text,
      width: p.width,
      height: p.height,
      warning: printWarning(p.width ?? 0, p.height ?? 0),
      hidden: p.hidden,
    });
    photosByMemory.set(p.memory_id, list);
  }
  const coverUrl = urls.get(book.cover_display_path ?? "");
  const today = todayInUK();
  const open = isOpen({ closesOn: book.closes_on, closedAt: book.closed_at }, today);
  const closingText = book.closed_at
    ? `Closed early on ${formatDate(book.closed_at.slice(0, 10))}`
    : book.closes_on
      ? open
        ? `Open until ${formatDate(book.closes_on)} (${daysLeftText(book.closes_on, today)})`
        : `Closed: memories were welcome until ${formatDate(book.closes_on)}`
      : "Open, with no closing date";

  return (
    <article className={styles.book}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Admin · read-only</p>
        <h1>{book.full_name}</h1>
        {book.known_as && <p className={styles.knownAs}>Known as {book.known_as}</p>}
      </header>

      <div className={styles.overview}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- private link that expires; not cached by Next.js
          <img src={coverUrl} alt={`Cover photograph of ${book.full_name}`} className={styles.cover} />
        ) : (
          <div className={styles.noCover}>No cover photo</div>
        )}
        <dl className={styles.facts}>
          <div>
            <dt>Organiser</dt>
            <dd>
              {info?.organiser_name || "No name"}
              {info?.organiser_email && (
                <>
                  <br />
                  <a href={`mailto:${info.organiser_email}`}>{info.organiser_email}</a>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={open ? "open-label" : "closed-label"}>{open ? "Open" : "Closed"}</span>{" "}
              {closingText}
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDate(book.created_at.slice(0, 10))}</dd>
          </div>
          <div>
            <dt>Born</dt>
            <dd>{formatDate(book.date_of_birth) || "Not given"}</dd>
          </div>
          <div>
            <dt>Died</dt>
            <dd>{formatDate(book.date_of_death) || "Not given"}</dd>
          </div>
          {book.lived_in && (
            <div>
              <dt>Lived in</dt>
              <dd>{book.lived_in}</dd>
            </div>
          )}
          <div>
            <dt>Memories</dt>
            <dd>
              {allMemories.length} ({count("approved")} approved, {count("waiting")} waiting, {count("hidden")} hidden)
            </dd>
          </div>
          <div>
            <dt>Photos</dt>
            <dd>
              {allPhotos.length}
              {allPhotos.some((p) => p.hidden) && ` (${allPhotos.filter((p) => p.hidden).length} hidden)`}
            </dd>
          </div>
        </dl>
      </div>

      {book.cover_display_path && printWarning(book.cover_width ?? 0, book.cover_height ?? 0) && (
        <p className="photo-warning">{printWarning(book.cover_width ?? 0, book.cover_height ?? 0)}</p>
      )}

      <section className={styles.panel} aria-labelledby="layout-heading">
        <h2 id="layout-heading">Download for layout</h2>
        <LayoutDownload getPackage={getLayoutPackage.bind(null, book.id)} />
      </section>

      <section className={styles.panel} aria-labelledby="emails-heading">
        <h2 id="emails-heading">Test the emails</h2>
        <TestEmailsButton send={adminSendTestEmails.bind(null, book.id)} />
      </section>

      {book.introduction && (
        <section className={styles.block} aria-labelledby="intro-heading">
          <h2 id="intro-heading">Introduction</h2>
          <p className={styles.text}>{book.introduction}</p>
        </section>
      )}

      <section className={styles.block} aria-labelledby="memories-heading">
        <h2 id="memories-heading">All memories ({allMemories.length})</h2>
        {allMemories.length === 0 ? (
          <p className="muted">No memories yet.</p>
        ) : (
          <ol className={styles.memories}>
            {allMemories.map((m) => {
              const edited = m.edited_memory !== null || m.edited_sayings !== null;
              return (
                <li key={m.id} className={`review-card review-${m.status}`}>
                  <header className="review-header">
                    <div className="review-who">
                      <p className="review-name">{m.contributor_name}</p>
                      <p className="review-meta">
                        {m.relationship} · <a href={`mailto:${m.contributor_email}`}>{m.contributor_email}</a>
                      </p>
                      <p className="review-meta">Sent {formatSent(m.created_at)}</p>
                    </div>
                    <p className={`status-badge status-${m.status}`}>{statusLabels[m.status] ?? m.status}</p>
                  </header>
                  {edited && <p className="review-meta">Edited by the organiser. The text below is their version.</p>}
                  <p className="review-text">{m.edited_memory ?? m.memory}</p>
                  {(m.edited_sayings ?? m.sayings) && (
                    <blockquote className="review-sayings">
                      <p className="review-sayings-label">Favourite sayings</p>
                      <p className="review-text">{m.edited_sayings ?? m.sayings}</p>
                    </blockquote>
                  )}
                  {photosByMemory.has(m.id) && (
                    <PhotoGallery
                      photos={photosByMemory.get(m.id)!}
                      contributorName={m.contributor_name}
                      getDownloadUrl={adminDownloadUrl}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </article>
  );
}

function formatSent(timestamp: string) {
  const date = new Date(timestamp);
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(date);
  return `${day} at ${time}`;
}
