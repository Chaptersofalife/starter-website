// One book: chaptersofalife...com/my-books/<book id>
// Row Level Security means an organiser can only ever load their own books
// and their memories. Anyone else's book simply isn't found.
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import {
  abandonCoverUpload,
  createNewInviteLink,
  deleteBook,
  getOriginalDownloadUrl,
  prepareCoverUpload,
  removeCover,
  saveCover,
} from "@/app/my-books/actions";
import CoverPhoto from "@/components/books/CoverPhoto";
import DeleteBook from "@/components/books/DeleteBook";
import InviteLink from "@/components/books/InviteLink";
import PhotoGallery, { type GalleryPhoto } from "@/components/books/PhotoGallery";
import { bookColumns, formatDate, isBookId, type Book } from "@/lib/books";
import { invitePath } from "@/lib/invites";
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
};

type BookWithExtras = Book & {
  invite_token: string;
  cover_display_path: string | null;
  cover_width: number | null;
  cover_height: number | null;
};

export default function BookPage({ params, searchParams }: PageProps<"/my-books/[id]">) {
  return (
    <main className="section">
      <div className="container">
        <p className={styles.back}>
          <Link href="/my-books">← My books</Link>
        </p>
        <Suspense fallback={<p className="muted">Loading the book…</p>}>
          {Promise.all([params, searchParams]).then(([{ id }, query]) => (
            <BookDetails id={id} status={String(query.status ?? "")} />
          ))}
        </Suspense>
      </div>
    </main>
  );
}

async function BookDetails({ id, status }: { id: string; status: string }) {
  if (!isBookId(id)) notFound();

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const [{ data: book }, { data: memories, error: memoriesError }, { data: photos }] = await Promise.all([
    supabase
      .from("books")
      .select(`${bookColumns}, invite_token, cover_display_path, cover_width, cover_height`)
      .eq("id", id)
      .maybeSingle<BookWithExtras>(),
    supabase
      .from("memories")
      .select("id, contributor_name, contributor_email, relationship, memory, sayings, created_at")
      .eq("book_id", id)
      .order("created_at", { ascending: false })
      .returns<Memory[]>(),
    supabase
      .from("memory_photos")
      .select("id, memory_id, position, display_path, thumb_path, caption, taken_text, width, height")
      .eq("book_id", id)
      .eq("uploaded", true)
      .order("position")
      .returns<MemoryPhoto[]>(),
  ]);
  if (!book) notFound();
  if (memoriesError) console.error("Load memories failed:", memoriesError.code, memoriesError.message);

  const inviteUrl = `${await siteOrigin()}${invitePath(book.invite_token)}`;
  const personName = book.known_as || book.full_name.split(/\s+/)[0];

  // Private viewing links (valid for an hour) for the cover and all photos.
  const urls = await signedViewUrls([
    book.cover_display_path,
    ...(photos ?? []).flatMap((p) => [p.thumb_path, p.display_path]),
  ]);
  const photosByMemory = new Map<string, GalleryPhoto[]>();
  for (const p of photos ?? []) {
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
    });
    photosByMemory.set(p.memory_id, list);
  }

  return (
    <article className={styles.book}>
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

      <section className={styles.coverSection} aria-labelledby="cover-heading">
        <h2 id="cover-heading" className="visually-hidden">
          Cover photo
        </h2>
        <CoverPhoto
          bookName={book.full_name}
          coverUrl={urls.get(book.cover_display_path ?? "") ?? null}
          warning={book.cover_display_path ? printWarning(book.cover_width ?? 0, book.cover_height ?? 0) : null}
          prepareUpload={prepareCoverUpload.bind(null, book.id)}
          save={saveCover.bind(null, book.id)}
          remove={removeCover.bind(null, book.id)}
          abandon={abandonCoverUpload.bind(null, book.id)}
        />
      </section>

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

      <section className={styles.introduction} aria-labelledby="intro-heading">
        <h2 id="intro-heading">Introduction</h2>
        {book.introduction ? (
          <p className={styles.introText}>{book.introduction}</p>
        ) : (
          <p className="muted">
            No introduction yet. You can add a few words about them by editing
            the details.
          </p>
        )}
      </section>

      <div className={styles.bookActions}>
        <Link href={`/my-books/${book.id}/edit`} className="button">
          Edit details
        </Link>
        <DeleteBook action={deleteBook.bind(null, book.id)} bookName={book.full_name} />
      </div>

      {/* ---------- Invite family and friends ---------- */}
      <section id="invite" className={styles.section} aria-labelledby="invite-heading">
        <h2 id="invite-heading">Invite family and friends</h2>
        <p className="muted">
          Send this private link to the people who knew {personName}. They
          can share a memory without creating an account. They won&rsquo;t
          see anyone else&rsquo;s memories, and only you can read what they
          send.
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
        <InviteLink url={inviteUrl} createNewLink={createNewInviteLink.bind(null, book.id)} />
      </section>

      {/* ---------- Memories received ---------- */}
      <section className={styles.section} aria-labelledby="memories-heading">
        <h2 id="memories-heading">
          Memories received{memories && memories.length > 0 ? ` (${memories.length})` : ""}
        </h2>

        {memoriesError ? (
          <p className="form-error" role="alert">
            Sorry, we couldn&rsquo;t load the memories just now. Please refresh the page.
          </p>
        ) : !memories || memories.length === 0 ? (
          <p className="muted">
            No memories yet. When family and friends use your link, their
            memories will appear here, newest first.
          </p>
        ) : (
          <ol className={styles.memories}>
            {memories.map((m) => (
              <li key={m.id} className={styles.memory}>
                <header className={styles.memoryHeader}>
                  <p className={styles.memoryName}>{m.contributor_name}</p>
                  <p className={styles.memoryMeta}>
                    {m.relationship} · {formatReceived(m.created_at)}
                  </p>
                </header>
                <p className={styles.memoryText}>{m.memory}</p>
                {photosByMemory.has(m.id) && (
                  <PhotoGallery
                    photos={photosByMemory.get(m.id)!}
                    contributorName={m.contributor_name}
                    getDownloadUrl={getOriginalDownloadUrl}
                  />
                )}
                {m.sayings && (
                  <blockquote className={styles.sayings}>
                    <p className={styles.sayingsLabel}>Favourite sayings</p>
                    <p className={styles.memoryText}>{m.sayings}</p>
                  </blockquote>
                )}
                <p className={styles.memoryEmail}>
                  <a href={`mailto:${m.contributor_email}`}>{m.contributor_email}</a>
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}

/** "17 November 2026" */
function formatReceived(timestamp: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(timestamp));
}

// The address of the site being used (live site, preview or your computer),
// so the invite link always points to the right place.
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
