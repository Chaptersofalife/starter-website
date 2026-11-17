// Shared rules for email invitations (used by the browser and the server).

import { invitePath } from "@/lib/invites";

export const MAX_INVITES_PER_SEND = 50;
export const MAX_INVITES_PER_BOOK = 300;
export const MESSAGE_MAX = 1000;
export const FIRST_NAME_MAX = 60;

export type InvitePerson = { email: string; firstName: string | null };

/** Words that go with the next name in a greeting, e.g. "Uncle Bob". */
const titles = new Set([
  "uncle", "auntie", "aunty", "aunt", "nan", "nana", "nanna", "gran", "granny", "grandma",
  "grandad", "granddad", "grandpa", "cousin", "mr", "mrs", "ms", "miss", "mx", "dr", "rev", "sir", "dame",
]);

const emailPattern = /[^\s<>,;"'()]+@[^\s<>,;"'()]+\.[^\s<>,;"'()]+/;

/**
 * Reads a pasted list, one person per line. Any of these work:
 *   sarah@example.com
 *   Sarah, sarah@example.com
 *   sarah@example.com, Sarah
 *   Sarah Jones <sarah@example.com>
 * Lines without an email address are returned in `invalid`.
 */
export function parseInviteList(text: string): { people: InvitePerson[]; invalid: string[]; duplicates: number } {
  const people: InvitePerson[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (const rawLine of text.split(/\r?\n|;/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(emailPattern);
    if (!match) {
      invalid.push(line);
      continue;
    }
    const email = match[0].toLowerCase().replace(/[.]+$/, "");
    if (email.length > 254) {
      invalid.push(line);
      continue;
    }
    if (seen.has(email)) {
      duplicates++;
      continue;
    }
    seen.add(email);

    // Whatever's left is their name. We use their first name, keeping a title
    // with it ("Uncle Bob", "Mrs Patel") so the greeting sounds right.
    const rest = line.replace(match[0], " ").replace(/[<>,;"()]/g, " ").replace(/\s+/g, " ").trim();
    const words = rest ? rest.split(" ") : [];
    const keepTwo = words.length > 1 && titles.has(words[0].toLowerCase().replace(/\.$/, ""));
    const firstName = words.length ? words.slice(0, keepTwo ? 2 : 1).join(" ").slice(0, FIRST_NAME_MAX) : null;
    people.push({ email, firstName: firstName || null });
  }
  return { people, invalid, duplicates };
}

/** A person's own invite link: the book's link plus their personal code. */
export function personalInviteLink(baseUrl: string, bookInviteToken: string, personalToken: string) {
  return `${baseUrl}${invitePath(bookInviteToken)}?i=${personalToken}`;
}

/** The "stop reminders" link for one person and one book. */
export function stopRemindersLink(baseUrl: string, personalToken: string) {
  return `${baseUrl}/reminders/stop?t=${personalToken}`;
}
