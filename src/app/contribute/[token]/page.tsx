// The page contributors open from a private invite link:
// chaptersofalife...com/contribute/<private code>
// No account needed. It shows only the person's name and dates, and the
// form to share a memory. Nothing else about the book is visible here.
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { abandonMemoryPhoto, finishMemoryPhotos, submitMemory } from "@/app/contribute/actions";
import MemoryForm from "@/components/contribute/MemoryForm";
import { lifeDates } from "@/lib/books";
import { shortDate } from "@/lib/closing";
import { isInviteToken } from "@/lib/invites";
import { signedViewUrls } from "@/lib/photos-server";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Share a memory",
  // Keep private links out of search engines, and don't pass them on to other sites.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Invite = {
  full_name: string;
  known_as: string | null;
  date_of_birth: string | null;
  date_of_death: string | null;
  cover_display_path: string | null;
  closes_on: string | null;
  /** Decided by the database: false once the closing date has passed or the organiser closed it. */
  is_open: boolean;
};

export default function ContributePage({ params }: PageProps<"/contribute/[token]">) {
  return (
    <main className="section">
      <div className="container">
        <Suspense fallback={<p className="muted">Loading…</p>}>
          {params.then(({ token }) => (
            <Contribute token={token} />
          ))}
        </Suspense>
      </div>
    </main>
  );
}

async function Contribute({ token }: { token: string }) {
  // This page depends on today's date (is the book still open?), so it is
  // always made fresh for each visitor.
  await connection();
  let invite: Invite | null = null;
  if (isInviteToken(token)) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_invite", { invite: token });
    if (error) console.error("get_invite failed:", error.code, error.message);
    invite = (data as Invite[] | null)?.[0] ?? null;
  }

  if (!invite) {
    return (
      <div className="reading">
        <h1>This link isn&rsquo;t working</h1>
        <p className={styles.lead}>
          The link may have been typed incorrectly, or it may have been
          replaced with a new one. Please ask the person who invited you to
          send you the link again.
        </p>
      </div>
    );
  }

  const personName = invite.known_as || invite.full_name.split(/\s+/)[0];
  const dates = lifeDates(invite);
  // A private viewing link for the cover photo, valid for an hour.
  const coverUrl = (await signedViewUrls([invite.cover_display_path])).get(
    invite.cover_display_path ?? "",
  );

  return (
    <div className={styles.layout}>
      <header className={styles.intro}>
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- private link that expires; not cached by Next.js
          <img src={coverUrl} alt={`A photograph of ${invite.full_name}`} className={styles.cover} />
        )}
        <p className={styles.eyebrow}>In loving memory of</p>
        <h1>{invite.full_name}</h1>
        {invite.known_as && <p className={styles.knownAs}>Known as {invite.known_as}</p>}
        {dates && <p className={styles.dates}>{dates}</p>}
        <hr className="ornament" />
        {invite.is_open ? (
          <>
            {invite.closes_on && (
              <p className={styles.closing}>Please add your memories by {shortDate(invite.closes_on)}.</p>
            )}
            <p className={styles.lead}>
              You&rsquo;ve been invited to share a memory of {personName}. Your
              words will become part of a book their family will keep.
            </p>
            <p className={styles.lead}>
              There&rsquo;s no right or wrong way to do this. A few lines or a long
              story are equally precious. Take your time.
            </p>
          </>
        ) : (
          <p className={styles.lead}>
            A book of memories is being made for {personName}&rsquo;s family.
          </p>
        )}
      </header>

      <div className={styles.formPanel}>
        {invite.is_open ? (
          <MemoryForm
            submit={submitMemory.bind(null, token)}
            finishPhotos={finishMemoryPhotos.bind(null, token)}
            abandonPhoto={abandonMemoryPhoto.bind(null, token)}
            personName={personName}
          />
        ) : (
          <BookClosedMessage />
        )}
      </div>
    </div>
  );
}

/** Shown instead of the form once the book has closed. */
function BookClosedMessage() {
  return (
    <div className="thank-you" role="status">
      <h2>This book is now closed</h2>
      <p>
        This book is now closed to new memories. Thank you for being part of it.
      </p>
      <p>
        If you have something you&rsquo;d still like to share, please get in touch with the person
        who invited you.
      </p>
    </div>
  );
}
