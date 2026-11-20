// One book: chaptersofalife...com/my-books/<book id>
// The organiser reviews memories here, shares the invite link, and manages
// the cover photo and details.
// Row Level Security means an organiser can only ever load (and change) their
// own books, memories and photos. Anyone else's book simply isn't found.
import type { Metadata } from "next";
import { connection } from "next/server";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import {
  abandonCoverUpload,
  closeBookNow,
  createNewInviteLink,
  deleteBook,
  getOriginalDownloadUrl,
  prepareCoverUpload,
  removeCover,
  reopenBook,
  saveCover,
  setClosingDate,
} from "@/app/my-books/actions";
import {
  deleteMemory,
  saveMemoryEdit,
  setFavourite,
  setMemoryStatus,
  setPhotoHidden,
  undoMemoryEdit,
  type MemoryStatus,
} from "@/app/my-books/review-actions";
import { removeInvitation, resendInvitation, sendInvitations } from "@/app/my-books/invitation-actions";
import BookClosing from "@/components/books/BookClosing";
import CoverPhoto from "@/components/books/CoverPhoto";
import InvitationsPanel, { type InvitedPerson } from "@/components/books/InvitationsPanel";
import DeleteBook from "@/components/books/DeleteBook";
import InviteLink from "@/components/books/InviteLink";
import MemoryReview, { type ReviewMemory } from "@/components/books/MemoryReview";
import type { GalleryPhoto } from "@/components/books/PhotoGallery";
import { bookColumns, formatDate, isBookId, todayInUK, type Book } from "@/lib/books";
import { daysLeftText, isOpen } from "@/lib/closing";
import { invitePath } from "@/lib/invites";
import { MEMORIES_FOR_24_PAGES, formatPounds, orderStatusLabels, paidStatuses, type OrderStatus } from "@/lib/orders";
import { printWarning } from "@/lib/photos";
import { signedViewUrls } from "@/lib/photos-server";
import { createClient } from "@/lib/supabase/server";
import styles from "../books.module.css";

export const metadata: Metadata = {
  title: "Book",
  robots: { index: false },
  // The page shows a private link: don't pass this page's address to other sites.
  referrer: "no-referrer",
};

type Memory = {
  id: string;
  contributor_name: string;
  contributor_email: string;
  relationship: string;
  memory: string;
  sayings: string | null;
  status: MemoryStatus;
  favourite: boolean;
  edited_memory: string | null;
  edited_sayings: string | null;
  invitation_id: string | null;
  created_at: string;
};

type MemoryPhoto = {
  id: string;
  memory_id: string;
  position: number;
  display_path: string;
  thumb_path: string;
  caption: string | null;
  taken_text: string | null;
  width: number | null;
  height: number | null;
  hidden: boolean;
};

type BookWithExtras = Book & {
  invite_token: string;
  locked_at: string | null;
  cover_display_path: string | null;
  cover_width: number | null;
  cover_height: number | null;
};

type Filter = "all" | MemoryStatus | "favourites";
const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "favourites", label: "★ Favourites" },
  { value: "waiting", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "hidden", label: "Hidden" },
];

export default function BookPage({ params, searchParams }: PageProps<"/my-books/[id]">) {
  return (
    <main className="section">
      <div className="container">
        <p className={styles.back}>
          <Link href="/my-books">← My books</Link>
        </p>
        <Suspense fallback={<p className="muted">Loading the book…</p>}>
          {Promise.all([params, searchParams]).then(([{ id }, query]) => (
            <BookDetails id={id} status={String(query.status ?? "")} show={String(query.show ?? "all")} />
          ))}
        </Suspense>
      </div>
    </main>
  );
}

async function BookDetails({ id, status, show }: { id: string; status: string; show: string }) {
  await connection(); // uses today's date (closing date)
  if (!isBookId(id)) notFound();
  const filter: Filter = filters.some((f) => f.value === show) ? (show as Filter) : "all";

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const [{ data: book }, { data: memories, error: memoriesError }, { data: photos }, { data: invitations }, { data: orders }] = await Promise.all([
    supabase
      .from("books")
      .select(`${bookColumns}, invite_token, locked_at, cover_display_path, cover_width, cover_height`)
      .eq("id", id)
      .maybeSingle<BookWithExtras>(),
    supabase
      .from("memories")
      .select(
        "id, contributor_name, contributor_email, relationship, memory, sayings, status, favourite, edited_memory, edited_sayings, invitation_id, created_at",
      )
      .eq("book_id", id)
      .order("created_at", { ascending: false })
      .returns<Memory[]>(),
    supabase
      .from("memory_photos")
      .select("id, memory_id, position, display_path, thumb_path, caption, taken_text, width, height, hidden")
      .eq("book_id", id)
      .eq("uploaded", true)
      .order("position")
      .returns<MemoryPhoto[]>(),
    supabase
      .from("invitations")
      .select("id, email, first_name, send_count, last_sent_at, reminders_stopped_at, created_at")
      .eq("book_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, status, total_copies, amount_pence, paid_at, created_at, tracking_number, tracking_url")
      .eq("book_id", id)
      .in("status", paidStatuses)
      .order("created_at", { ascending: false })
      .returns<
        {
          id: string;
          status: OrderStatus;
          total_copies: number;
          amount_pence: number;
          paid_at: string | null;
          created_at: string;
          tracking_number: string | null;
          tracking_url: string | null;
        }[]
      >(),
  ]);
  if (!book) notFound();
  if (memoriesError) console.error("Load memories failed:", memoriesError.code, memoriesError.message);

  const inviteUrl = `${await siteOrigin()}${invitePath(book.invite_token)}`;
  const personName = book.known_as || book.full_name.split(/\s+/)[0];
  // Once a preview is approved, the book can't be changed (the database enforces this).
  const locked = Boolean(book.locked_at);

  // Is the book still welcoming memories?
  const today = todayInUK();
  const open = isOpen({ closesOn: book.closes_on, closedAt: book.closed_at }, today);
  let closingHeadline: string;
  let closingDetail: string | null = null;
  if (open) {
    closingHeadline = book.closes_on
      ? `Memories welcome until ${formatDate(book.closes_on)} (${daysLeftText(book.closes_on, today)})`
      : "Memories welcome, with no closing date set";
  } else if (book.closed_at) {
    closingHeadline = `You closed this book on ${formatDayUK(book.closed_at)}`;
    closingDetail = "New memories and photos can't be added. You can reopen it at any time.";
  } else {
    closingHeadline = `Memories were welcome until ${formatDate(book.closes_on!)}`;
    closingDetail = "The closing date has passed, so new memories and photos can't be added. You can reopen it at any time.";
  }

  const allMemories = memories ?? [];
  const allPhotos = photos ?? [];

  // The summary at the top.
  const count = (s: MemoryStatus) => allMemories.filter((m) => m.status === s).length;
  const summary = {
    memories: allMemories.length,
    photos: allPhotos.length,
    approved: count("approved"),
    waiting: count("waiting"),
    hidden: count("hidden"),
    favourites: allMemories.filter((m) => m.favourite).length,
  };
  const shown =
    filter === "all"
      ? allMemories
      : filter === "favourites"
        ? allMemories.filter((m) => m.favourite)
        : allMemories.filter((m) => m.status === filter);

  // Private viewing links (valid for an hour) for the cover and the photos shown.
  const shownIds = new Set(shown.map((m) => m.id));
  const shownPhotos = allPhotos.filter((p) => shownIds.has(p.memory_id));
  const urls = await signedViewUrls([
    book.cover_display_path,
    ...shownPhotos.flatMap((p) => [p.thumb_path, p.display_path]),
  ]);
  const photosByMemory = new Map<string, GalleryPhoto[]>();
  for (const p of shownPhotos) {
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

  // Who has been invited by email, and have they added a memory yet?
  const contributedEmails = new Set(allMemories.map((m) => m.contributor_email.toLowerCase()));
  const contributedInvites = new Set(allMemories.map((m) => m.invitation_id).filter(Boolean));
  const invitedPeople: InvitedPerson[] = (invitations ?? []).map((inv) => ({
    id: inv.id,
    email: inv.email,
    firstName: inv.first_name,
    lastSent: inv.last_sent_at ? formatShortDay(inv.last_sent_at) : null,
    sendCount: inv.send_count ?? 0,
    contributed: contributedInvites.has(inv.id) || contributedEmails.has(inv.email),
    remindersStopped: Boolean(inv.reminders_stopped_at),
  }));

  const reviewActions = {
    setStatus: setMemoryStatus,
    setFavourite,
    saveEdit: saveMemoryEdit,
    undoEdit: undoMemoryEdit,
    setPhotoHidden,
    deleteMemory,
    getDownloadUrl: getOriginalDownloadUrl,
  };

  return (
    <article className={styles.bookWide}>
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

      {locked && (
        <p className={styles.notice} role="status">
          This book has been approved for printing, so it can no longer be changed.
        </p>
      )}

      {/* ---------- Closing date ---------- */}
      <section aria-label="Closing date" className={styles.closingSection}>
        <BookClosing
          open={open}
          closesOn={book.closes_on}
          headline={closingHeadline}
          detail={closingDetail}
          locked={locked}
          actions={{
            setDate: setClosingDate.bind(null, book.id),
            closeNow: closeBookNow.bind(null, book.id),
            reopen: reopenBook.bind(null, book.id),
          }}
        />
      </section>

      {/* ---------- Ordering the book ---------- */}
      {(!open || (orders && orders.length > 0)) && (
        <section className={styles.orderSection} aria-labelledby="order-heading">
          <h2 id="order-heading">Your book</h2>
          {orders && orders.length > 0 && (
            <ul className={styles.orderList}>
              {orders.map((o) => (
                <li key={o.id} className={styles.orderItem}>
                  <span className={o.status === "refunded" ? "closed-label" : "open-label"}>{orderStatusLabels[o.status]}</span>
                  <span>
                    {o.total_copies} {o.total_copies === 1 ? "copy" : "copies"} · {formatPounds(o.amount_pence)} · ordered{" "}
                    {formatDayUK(o.paid_at ?? o.created_at)}
                  </span>
                  {o.status === "preview_sent" && (
                    <span className={styles.orderNext}>
                      Your preview is ready to look through.{" "}
                      <Link href={`/my-books/${book.id}/preview`} className="button">
                        View your preview
                      </Link>
                    </span>
                  )}
                  {o.status === "changes_requested" && (
                    <span className={styles.orderNext}>
                      Thank you. We&rsquo;re making your changes and will email you the updated preview.{" "}
                      <Link href={`/my-books/${book.id}/preview`}>See the preview</Link>
                    </span>
                  )}
                  {(o.status === "approved" || o.status === "sent_to_printer") && (
                    <span className={styles.orderNext}>
                      Thank you for approving your book. We&rsquo;ll email you when it&rsquo;s on its way.{" "}
                      <Link href={`/my-books/${book.id}/preview`}>See the approved preview</Link>
                    </span>
                  )}
                  {(o.status === "dispatched" || o.status === "delivered") && (o.tracking_number || o.tracking_url) && (
                    <span className={styles.orderNext}>
                      {o.tracking_number && <>Tracking number: <strong>{o.tracking_number}</strong> </>}
                      {o.tracking_url && (
                        <a href={o.tracking_url} target="_blank" rel="noopener noreferrer">
                          Track delivery
                        </a>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!open && !locked && (
            <div className="actions">
              <Link href={`/my-books/${book.id}/order`} className={orders && orders.length > 0 ? "button button-secondary" : "button"}>
                {orders && orders.length > 0 ? "Order more copies" : "Order your book"}
              </Link>
            </div>
          )}
          {!open && (!orders || orders.length === 0) && (
            <p className="muted">
              When you&rsquo;ve chosen the memories to include, order your keepsake book. We&rsquo;ll send you a
              preview to approve before anything is printed.
            </p>
          )}
        </section>
      )}

      {/* ---------- Summary ---------- */}
      <section aria-labelledby="summary-heading" className={styles.summarySection}>
        <h2 id="summary-heading" className="visually-hidden">
          Summary
        </h2>
        <dl className={styles.summary}>
          <div>
            <dt>Memories received</dt>
            <dd>{summary.memories}</dd>
          </div>
          <div>
            <dt>Photos received</dt>
            <dd>{summary.photos}</dd>
          </div>
          <div className={styles.summaryApproved}>
            <dt>Approved</dt>
            <dd>{summary.approved}</dd>
          </div>
          <div className={styles.summaryWaiting}>
            <dt>Waiting for review</dt>
            <dd>{summary.waiting}</dd>
          </div>
          <div className={styles.summaryHidden}>
            <dt>Hidden</dt>
            <dd>{summary.hidden}</dd>
          </div>
          <div className={styles.summaryWaiting}>
            <dt>★ Favourites</dt>
            <dd>{summary.favourites}</dd>
          </div>
        </dl>
        {summary.memories === 0 && (
          <p className="muted">
            No memories yet. <a href="#invite">Share your invite link</a> with family and friends,
            and their memories will appear here for you to review.
          </p>
        )}
      </section>

      {/* ---------- Memories ---------- */}
      {summary.memories > 0 && (
        <section id="memories" className={styles.reviewSection} aria-labelledby="memories-heading">
          <div className={styles.reviewHead}>
            <h2 id="memories-heading">Memories</h2>
            <p className="muted">
              Approved memories will go in the book. Hidden ones are kept safely, but left out.
            </p>
            <p className={styles.fitNote}>
              A 24-page book fits about {MEMORIES_FOR_24_PAGES} memories, depending on their length and photos
              (choose 32 pages when you order for a few more). Star your <strong>★ favourites</strong> so we
              know which ones matter most to you.
            </p>
          </div>

          <nav aria-label="Show memories" className={styles.filters}>
            {filters.map((f) => {
              const n = f.value === "all" ? summary.memories : summary[f.value];
              return (
                <Link
                  key={f.value}
                  href={f.value === "all" ? `/my-books/${book.id}#memories` : `/my-books/${book.id}?show=${f.value}#memories`}
                  className={styles.filter}
                  aria-current={filter === f.value ? "page" : undefined}
                  scroll={false}
                >
                  {f.label} <span className={styles.filterCount}>{n}</span>
                </Link>
              );
            })}
          </nav>

          {memoriesError ? (
            <p className="form-error" role="alert">
              Sorry, we couldn&rsquo;t load the memories just now. Please refresh the page.
            </p>
          ) : shown.length === 0 ? (
            <p className="muted">
              {filter === "waiting" && "Nothing is waiting for review. You're all caught up."}
              {filter === "approved" && "No memories have been approved yet."}
              {filter === "hidden" && "No memories are hidden."}
              {filter === "favourites" && "No favourites yet. Tap the ☆ on a memory to star it."}
            </p>
          ) : (
            <ol className={styles.reviewList}>
              {shown.map((m) => {
                const memory: ReviewMemory = {
                  id: m.id,
                  contributorName: m.contributor_name,
                  contributorEmail: m.contributor_email,
                  relationship: m.relationship,
                  sentAt: formatSent(m.created_at),
                  status: m.status,
                  favourite: m.favourite,
                  originalMemory: m.memory,
                  originalSayings: m.sayings,
                  editedMemory: m.edited_memory,
                  editedSayings: m.edited_sayings,
                  photos: photosByMemory.get(m.id) ?? [],
                };
                return (
                  <li key={m.id}>
                    <MemoryReview memory={memory} actions={reviewActions} readOnly={locked} />
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {/* ---------- Invite family and friends ---------- */}
      <section id="invite" className={styles.section} aria-labelledby="invite-heading">
        <h2 id="invite-heading">Invite family and friends</h2>
        <p className="muted">
          Share this private link yourself, or invite people by email below
          and we&rsquo;ll send them a gentle reminder before the book closes.
          They can share a memory of {personName} without creating an
          account. They won&rsquo;t see anyone else&rsquo;s memories, and only
          you can read what they send.
        </p>
        {status === "new-link" && (
          <p className={styles.notice} role="status">
            Your new link is ready. The old link no longer works.
          </p>
        )}
        {status === "link-failed" && (
          <p className="form-error" role="alert">
            Sorry, we couldn&rsquo;t create a new link just now. Your current link
            still works. Please try again.
          </p>
        )}
        {!open && (
          <p className="photo-warning">
            The book is closed, so anyone opening this link sees a thank-you message instead of the form.
          </p>
        )}
        <InviteLink url={inviteUrl} createNewLink={createNewInviteLink.bind(null, book.id)} />
        <InvitationsPanel
          open={open}
          readOnly={locked}
          people={invitedPeople}
          actions={{
            send: sendInvitations.bind(null, book.id),
            resend: resendInvitation,
            remove: removeInvitation,
          }}
        />
      </section>

      {/* ---------- Cover photo ---------- */}
      <section className={styles.section} aria-labelledby="cover-heading">
        <h2 id="cover-heading">Cover photo</h2>
        <CoverPhoto
          bookName={book.full_name}
          coverUrl={urls.get(book.cover_display_path ?? "") ?? null}
          warning={book.cover_display_path ? printWarning(book.cover_width ?? 0, book.cover_height ?? 0) : null}
          prepareUpload={prepareCoverUpload.bind(null, book.id)}
          save={saveCover.bind(null, book.id)}
          remove={removeCover.bind(null, book.id)}
          abandon={abandonCoverUpload.bind(null, book.id)}
          readOnly={locked}
        />
      </section>

      {/* ---------- Details ---------- */}
      <section className={styles.section} aria-labelledby="details-heading">
        <h2 id="details-heading">About {personName}</h2>
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
        <div className={styles.introduction}>
          <h3>Introduction</h3>
          {book.introduction ? (
            <p className={styles.introText}>{book.introduction}</p>
          ) : (
            <p className="muted">
              No introduction yet. You can add a few words about them by editing the details.
            </p>
          )}
        </div>
        {!locked && (
          <div className={styles.bookActions}>
            <Link href={`/my-books/${book.id}/edit`} className="button">
              Edit details
            </Link>
            <DeleteBook action={deleteBook.bind(null, book.id)} bookName={book.full_name} />
          </div>
        )}
      </section>
    </article>
  );
}

/** "17 Nov" (UK time) */
function formatShortDay(timestamp: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }).format(
    new Date(timestamp),
  );
}

/** "17 November 2026" (UK time) */
function formatDayUK(timestamp: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(timestamp));
}

/** "17 November 2026 at 14:05" (UK time) */
function formatSent(timestamp: string) {
  const date = new Date(timestamp);
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(date);
  return `${day} at ${time}`;
}

// The address of the site being used (live site, preview or your computer),
// so the invite link always points to the right place.
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
