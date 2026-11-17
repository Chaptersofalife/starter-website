// The daily reminder check (server only, uses the secret key).
//
// For each book with a closing date:
//   - 7 days before (or up to 3 days before, if a day was missed): a gentle
//     reminder to invited people who haven't added a memory yet
//   - 2 days before (or 1): a second reminder to them, and a summary to the
//     organiser
//   - once the book has closed (by date, or closed early): a short "your
//     book is closed" email to the organiser, sent once, within 3 days
// Each email is sent once per closing date (if the date changes, they can be
// sent again for the new date). Nothing is ever sent to invited people after
// the book closes, or to anyone who has stopped reminders.
import "server-only";
import { formatDate, todayInUK } from "@/lib/books";
import { addDays, daysBetween, isOpen, shortDate } from "@/lib/closing";
import { sendEmails, type EmailMessage } from "@/lib/email";
import {
  invitationEmail,
  organiserClosedEmail,
  organiserSummaryEmail,
  reminderEmail,
} from "@/lib/email-templates";
import { personalInviteLink, stopRemindersLink } from "@/lib/invitations";
import { getAdminClient } from "@/lib/supabase/admin";

type Book = {
  id: string;
  full_name: string;
  known_as: string | null;
  organiser_id: string;
  invite_token: string;
  closes_on: string | null;
  closed_at: string | null;
  reminder_7_sent_for: string | null;
  reminder_2_sent_for: string | null;
  organiser_summary_sent_for: string | null;
  organiser_closed_notice_key: string | null;
};

type Invitation = {
  id: string;
  email: string;
  first_name: string | null;
  token: string;
  personal_message: string | null;
  last_sent_at: string | null;
  reminders_stopped_at: string | null;
};

export type ReminderReport = {
  ranAt: string;
  booksChecked: number;
  remindersSent: number;
  organiserEmailsSent: number;
  failed: number;
  notes: string[];
};

const bookColumns =
  "id, full_name, known_as, organiser_id, invite_token, closes_on, closed_at, reminder_7_sent_for, reminder_2_sent_for, organiser_summary_sent_for, organiser_closed_notice_key";

const personNameOf = (b: Pick<Book, "known_as" | "full_name">) => b.known_as || b.full_name.split(/\s+/)[0];

/** Everything needed to email about one book. */
async function loadBookContext(bookId: string) {
  const admin = getAdminClient()!;
  const [{ data: invitations }, { data: memories }, { data: photos }] = await Promise.all([
    admin
      .from("invitations")
      .select("id, email, first_name, token, personal_message, last_sent_at, reminders_stopped_at")
      .eq("book_id", bookId)
      .returns<Invitation[]>(),
    admin.from("memories").select("contributor_email, invitation_id, status").eq("book_id", bookId),
    admin.from("memory_photos").select("id").eq("book_id", bookId).eq("uploaded", true),
  ]);
  const contributedEmails = new Set((memories ?? []).map((m) => (m.contributor_email ?? "").toLowerCase()));
  const contributedInvites = new Set((memories ?? []).map((m) => m.invitation_id).filter(Boolean));
  const hasContributed = (inv: Invitation) => contributedInvites.has(inv.id) || contributedEmails.has(inv.email);
  return {
    invitations: invitations ?? [],
    notYet: (invitations ?? []).filter((inv) => !hasContributed(inv)),
    memories: (memories ?? []).length,
    waiting: (memories ?? []).filter((m) => m.status === "waiting").length,
    photos: (photos ?? []).length,
  };
}

async function organiserOf(organiserId: string) {
  const admin = getAdminClient()!;
  const [{ data: user }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(organiserId),
    admin.from("profiles").select("full_name").eq("id", organiserId).maybeSingle(),
  ]);
  const email = user.user?.email ?? null;
  const name = (profile?.full_name || email?.split("@")[0] || "").trim();
  return { email, firstName: name.split(/\s+/)[0] || "there", fullName: name || "The family" };
}

function reminderFor(base: string, book: Book, organiserName: string, inv: Invitation, daysLeft: number): EmailMessage {
  const email = reminderEmail({
    toFirstName: inv.first_name,
    organiserName,
    personFullName: book.full_name,
    personName: personNameOf(book),
    closesOnText: book.closes_on ? shortDate(book.closes_on) : null,
    link: personalInviteLink(base, book.invite_token, inv.token),
    stopLink: stopRemindersLink(base, inv.token),
    daysLeft,
  });
  return {
    to: inv.email,
    ...email,
    headers: {
      "List-Unsubscribe": `<${base}/api/reminders/stop?t=${inv.token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

// ---------------------------------------------------------------------------

/** The daily check. `base` is the site address used in email links. */
export async function runReminders(base: string): Promise<ReminderReport> {
  const report: ReminderReport = {
    ranAt: new Date().toISOString(),
    booksChecked: 0,
    remindersSent: 0,
    organiserEmailsSent: 0,
    failed: 0,
    notes: [],
  };
  const admin = getAdminClient();
  if (!admin) {
    report.notes.push("SUPABASE_SECRET_KEY is missing.");
    return report;
  }

  const today = todayInUK();
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
  // Only books that might need an email today.
  const [{ data: byDate }, { data: closedEarly }] = await Promise.all([
    admin.from("books").select(bookColumns).gte("closes_on", addDays(today, -3)).lte("closes_on", addDays(today, 7)).returns<Book[]>(),
    admin.from("books").select(bookColumns).gte("closed_at", threeDaysAgo).returns<Book[]>(),
  ]);
  const books = new Map<string, Book>();
  for (const b of [...(byDate ?? []), ...(closedEarly ?? [])]) books.set(b.id, b);

  for (const book of books.values()) {
    report.booksChecked++;
    try {
      const open = isOpen({ closesOn: book.closes_on, closedAt: book.closed_at }, today);
      const changes: Partial<Book> = {};

      if (open && book.closes_on) {
        const daysLeft = daysBetween(today, book.closes_on);
        const stage: 7 | 2 | null = daysLeft >= 1 && daysLeft <= 2 ? 2 : daysLeft >= 3 && daysLeft <= 7 ? 7 : null;
        const alreadySent =
          stage === 2 ? book.reminder_2_sent_for === book.closes_on : stage === 7 ? book.reminder_7_sent_for === book.closes_on : true;
        const summaryDue = stage === 2 && book.organiser_summary_sent_for !== book.closes_on;

        if ((stage && !alreadySent) || summaryDue) {
          const ctx = await loadBookContext(book.id);
          const organiser = await organiserOf(book.organiser_id);

          if (stage && !alreadySent) {
            const recentlyContacted = (inv: Invitation) =>
              Boolean(inv.last_sent_at && Date.now() - Date.parse(inv.last_sent_at) < 2 * 86_400_000);
            const recipients = ctx.notYet.filter((inv) => !inv.reminders_stopped_at && !recentlyContacted(inv));
            if (recipients.length > 0) {
              const result = await sendEmails(recipients.map((inv) => reminderFor(base, book, organiser.fullName, inv, daysLeft)));
              report.remindersSent += result.sent;
              report.failed += result.failed;
              if (result.sent > 0) {
                await admin.from("invitations").update({ last_reminder_at: new Date().toISOString() }).in("id", recipients.map((r) => r.id));
              }
              if (result.failed > 0) continue; // try again tomorrow
            }
            changes.reminder_7_sent_for = book.closes_on;
            if (stage === 2) changes.reminder_2_sent_for = book.closes_on;
          }

          if (summaryDue && organiser.email) {
            const email = organiserSummaryEmail({
              organiserFirstName: organiser.firstName,
              personName: personNameOf(book),
              closesOnText: formatDate(book.closes_on),
              daysLeft,
              memories: ctx.memories,
              photos: ctx.photos,
              notYet: ctx.notYet.map((inv) => (inv.first_name ? `${inv.first_name} (${inv.email})` : inv.email)),
              bookUrl: `${base}/my-books/${book.id}`,
            });
            const result = await sendEmails([{ to: organiser.email, ...email }]);
            report.organiserEmailsSent += result.sent;
            report.failed += result.failed;
            if (result.sent > 0) changes.organiser_summary_sent_for = book.closes_on;
          }
        }
      }

      if (!open) {
        const key = book.closed_at ? `early:${book.closed_at}` : `date:${book.closes_on}`;
        const recent = book.closed_at
          ? Date.parse(book.closed_at) >= Date.parse(threeDaysAgo)
          : book.closes_on !== null && daysBetween(book.closes_on, today) <= 3;
        if (recent && book.organiser_closed_notice_key !== key) {
          const ctx = await loadBookContext(book.id);
          const organiser = await organiserOf(book.organiser_id);
          if (organiser.email) {
            const email = organiserClosedEmail({
              organiserFirstName: organiser.firstName,
              personName: personNameOf(book),
              memories: ctx.memories,
              photos: ctx.photos,
              waiting: ctx.waiting,
              bookUrl: `${base}/my-books/${book.id}`,
            });
            const result = await sendEmails([{ to: organiser.email, ...email }]);
            report.organiserEmailsSent += result.sent;
            report.failed += result.failed;
            if (result.sent > 0) changes.organiser_closed_notice_key = key;
          }
        }
      }

      if (Object.keys(changes).length > 0) {
        await admin.from("books").update(changes).eq("id", book.id);
      }
    } catch (e) {
      console.error("Reminder check failed for book", book.id, e);
      report.notes.push(`A book couldn't be checked (${book.id}).`);
    }
  }
  return report;
}

// ---------------------------------------------------------------------------

/**
 * Sends one sample of every email for a book to `to` (the admin), marked
 * [TEST]. Changes nothing and emails nobody else.
 */
export async function sendTestEmails(bookId: string, to: string, base: string) {
  const admin = getAdminClient();
  if (!admin) return { sent: 0, failed: 0, error: "SUPABASE_SECRET_KEY is missing." };
  const { data: book } = await admin.from("books").select(bookColumns).eq("id", bookId).maybeSingle<Book>();
  if (!book) return { sent: 0, failed: 0, error: "Book not found." };

  const ctx = await loadBookContext(book.id);
  const organiser = await organiserOf(book.organiser_id);
  const today = todayInUK();
  const closesOn = book.closes_on ?? addDays(today, 7);
  const sample: Invitation = {
    id: "sample",
    email: to,
    first_name: "Sarah",
    token: "sample-test-link",
    personal_message: "Mum loved hearing from all of you. We'd be so grateful for any memory, big or small.",
    last_sent_at: null,
    reminders_stopped_at: null,
  };
  const bookForSample = { ...book, closes_on: closesOn };
  const tag = (m: EmailMessage): EmailMessage => ({ ...m, to, subject: `[TEST] ${m.subject}`, headers: undefined });

  const invite = invitationEmail({
    toFirstName: sample.first_name,
    organiserName: organiser.fullName,
    personFullName: book.full_name,
    personName: personNameOf(book),
    closesOnText: shortDate(closesOn, today),
    link: personalInviteLink(base, book.invite_token, sample.token),
    stopLink: stopRemindersLink(base, sample.token),
    message: sample.personal_message,
  });

  const messages: EmailMessage[] = [
    tag({ to, ...invite }),
    tag(reminderFor(base, bookForSample, organiser.fullName, sample, 7)),
    tag(reminderFor(base, bookForSample, organiser.fullName, sample, 2)),
    tag({
      to,
      ...organiserSummaryEmail({
        organiserFirstName: organiser.firstName,
        personName: personNameOf(book),
        closesOnText: formatDate(closesOn),
        daysLeft: 2,
        memories: ctx.memories,
        photos: ctx.photos,
        notYet: ctx.notYet.length > 0 ? ctx.notYet.map((i) => i.first_name ?? i.email) : ["Sarah (example)"],
        bookUrl: `${base}/my-books/${book.id}`,
      }),
    }),
    tag({
      to,
      ...organiserClosedEmail({
        organiserFirstName: organiser.firstName,
        personName: personNameOf(book),
        memories: ctx.memories,
        photos: ctx.photos,
        waiting: ctx.waiting,
        bookUrl: `${base}/my-books/${book.id}`,
      }),
    }),
  ];
  return sendEmails(messages);
}
