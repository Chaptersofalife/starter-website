"use server";

// What happens when an organiser invites people by email, resends an
// invitation, or removes someone. Every request goes through the organiser's
// own sign-in, so Row Level Security checks it's their book.

import { revalidatePath } from "next/cache";
import { isBookId, todayInUK } from "@/lib/books";
import { isOpen, shortDate } from "@/lib/closing";
import { emailConfigured, sendEmails, type EmailMessage } from "@/lib/email";
import { invitationEmail } from "@/lib/email-templates";
import {
  MAX_INVITES_PER_BOOK,
  MAX_INVITES_PER_SEND,
  MESSAGE_MAX,
  parseInviteList,
  personalInviteLink,
  stopRemindersLink,
} from "@/lib/invitations";
import { requestOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";

export type InviteResult = {
  ok: boolean;
  error?: string;
  sent?: number;
  alreadyInvited?: string[];
  invalid?: string[];
  duplicates?: number;
};

type BookForEmail = {
  id: string;
  full_name: string;
  known_as: string | null;
  invite_token: string;
  closes_on: string | null;
  closed_at: string | null;
};

/** The signed-in organiser, their display name, and the book (if it's theirs). */
async function organiserAndBook(bookId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;
  const [{ data: book }, { data: profile }] = await Promise.all([
    supabase
      .from("books")
      .select("id, full_name, known_as, invite_token, closes_on, closed_at")
      .eq("id", bookId)
      .maybeSingle<BookForEmail>(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!book) return null;
  const organiserName = (profile?.full_name || user.email?.split("@")[0] || "The family").trim();
  return { supabase, user, book, organiserName };
}

function inviteEmailFor(
  base: string,
  book: BookForEmail,
  organiserName: string,
  organiserEmail: string | undefined,
  person: { email: string; first_name: string | null; token: string; personal_message: string | null },
): EmailMessage {
  const today = todayInUK();
  const open = isOpen({ closesOn: book.closes_on, closedAt: book.closed_at }, today);
  const stopLink = stopRemindersLink(base, person.token);
  const email = invitationEmail({
    toFirstName: person.first_name,
    organiserName,
    personFullName: book.full_name,
    personName: book.known_as || book.full_name.split(/\s+/)[0],
    closesOnText: open && book.closes_on ? shortDate(book.closes_on, today) : null,
    link: personalInviteLink(base, book.invite_token, person.token),
    stopLink,
    message: person.personal_message,
  });
  return {
    to: person.email,
    ...email,
    replyTo: organiserEmail,
    headers: {
      "List-Unsubscribe": `<${base}/api/reminders/stop?t=${person.token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

// ---------------------------------------------------------------------------

export async function sendInvitations(bookId: string, listText: string, message: string): Promise<InviteResult> {
  if (!isBookId(bookId)) return { ok: false, error: "We couldn't find this book." };
  if (!emailConfigured()) return { ok: false, error: "Email isn't set up yet. Please try again later." };
  const ctx = await organiserAndBook(bookId);
  if (!ctx) return { ok: false, error: "We couldn't find this book. Please log in again." };
  const { supabase, user, book, organiserName } = ctx;

  if (!isOpen({ closesOn: book.closes_on, closedAt: book.closed_at })) {
    return { ok: false, error: "This book is closed. Please reopen it before inviting more people." };
  }

  const cleanMessage = message.trim();
  if (cleanMessage.length > MESSAGE_MAX) {
    return { ok: false, error: `Please keep your message to ${MESSAGE_MAX.toLocaleString("en-GB")} characters or fewer.` };
  }

  const { people, invalid, duplicates } = parseInviteList(listText);
  if (people.length === 0) {
    return {
      ok: false,
      invalid,
      error: invalid.length > 0 ? "We couldn't find any email addresses. Please check the list." : "Please add at least one email address.",
    };
  }
  if (people.length > MAX_INVITES_PER_SEND) {
    return { ok: false, error: `Please invite up to ${MAX_INVITES_PER_SEND} people at a time.` };
  }

  // Skip anyone already invited (they can be sent the invitation again from the list).
  const { data: existing } = await supabase.from("invitations").select("email").eq("book_id", book.id);
  const existingEmails = new Set((existing ?? []).map((r) => r.email));
  const alreadyInvited = people.filter((p) => existingEmails.has(p.email)).map((p) => p.email);
  const toInvite = people.filter((p) => !existingEmails.has(p.email));
  if (existingEmails.size + toInvite.length > MAX_INVITES_PER_BOOK) {
    return { ok: false, error: `A book can have up to ${MAX_INVITES_PER_BOOK} email invitations.` };
  }
  if (toInvite.length === 0) {
    return { ok: true, sent: 0, alreadyInvited, invalid, duplicates };
  }

  const { data: rows, error } = await supabase
    .from("invitations")
    .insert(
      toInvite.map((p) => ({
        book_id: book.id,
        email: p.email,
        first_name: p.firstName,
        personal_message: cleanMessage || null,
      })),
    )
    .select("id, email, first_name, token, personal_message");
  if (error || !rows) {
    console.error("Saving invitations failed:", error?.code, error?.message);
    return { ok: false, error: "Sorry, the invitations couldn't be saved. Please try again." };
  }

  const base = await requestOrigin();
  const result = await sendEmails(rows.map((r) => inviteEmailFor(base, book, organiserName, user.email, r)));
  if (result.sent > 0) {
    await supabase
      .from("invitations")
      .update({ send_count: 1, last_sent_at: new Date().toISOString() })
      .in("id", rows.map((r) => r.id));
  }

  revalidatePath(`/my-books/${book.id}`);
  if (result.failed > 0) {
    return {
      ok: result.sent > 0,
      sent: result.sent,
      alreadyInvited,
      invalid,
      duplicates,
      error: `${result.failed === rows.length ? "The invitations" : `${result.failed} invitations`} couldn't be sent just now. They're saved in your list, so you can try "Resend" in a few minutes.`,
    };
  }
  return { ok: true, sent: result.sent, alreadyInvited, invalid, duplicates };
}

export async function resendInvitation(invitationId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isBookId(invitationId)) return { ok: false, error: "We couldn't find this invitation." };
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, book_id, email, first_name, token, personal_message, send_count, last_sent_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) return { ok: false, error: "We couldn't find this invitation." };

  if (inv.last_sent_at && Date.now() - Date.parse(inv.last_sent_at) < 10 * 60 * 1000) {
    return { ok: false, error: "This invitation was sent a few minutes ago. Please wait a little before sending it again." };
  }
  const ctx = await organiserAndBook(inv.book_id);
  if (!ctx) return { ok: false, error: "We couldn't find this book." };
  if (!isOpen({ closesOn: ctx.book.closes_on, closedAt: ctx.book.closed_at })) {
    return { ok: false, error: "This book is closed. Please reopen it before sending invitations." };
  }

  const base = await requestOrigin();
  const result = await sendEmails([inviteEmailFor(base, ctx.book, ctx.organiserName, ctx.user.email, inv)]);
  if (result.sent === 0) return { ok: false, error: "Sorry, the invitation couldn't be sent just now. Please try again." };

  await supabase
    .from("invitations")
    .update({ send_count: (inv.send_count ?? 0) + 1, last_sent_at: new Date().toISOString() })
    .eq("id", inv.id);
  revalidatePath(`/my-books/${inv.book_id}`);
  return { ok: true };
}

export async function removeInvitation(invitationId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isBookId(invitationId)) return { ok: false, error: "We couldn't find this invitation." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("invitations").delete().eq("id", invitationId).select("book_id");
  if (error || !data || data.length === 0) return { ok: false, error: "Sorry, that person couldn't be removed. Please try again." };
  revalidatePath(`/my-books/${data[0].book_id}`);
  return { ok: true };
}
