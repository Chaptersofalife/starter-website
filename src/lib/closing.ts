// Closing dates: when a book stops accepting new memories.
// Memories are welcome until the END of the closing day, UK time.
// The database uses the same rule (book_is_open), and it has the final say.

import { formatDate, isValidDate, todayInUK } from "@/lib/books";

/** How far ahead a new book's closing date is suggested. */
export const SUGGESTED_DAYS_OPEN = 21;
/** The furthest ahead a closing date can be set. */
export const MAX_DAYS_OPEN = 366;

/** "2026-11-17" plus 21 days = "2026-12-08". */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const result = new Date(Date.UTC(y, m - 1, d + days));
  return result.toISOString().slice(0, 10);
}

/** Whole days from one date to another (both "YYYY-MM-DD"). */
export function daysBetween(from: string, to: string) {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export type Closing = {
  closesOn: string | null;
  closedAt: string | null;
};

/** True if the book is still accepting memories today. */
export function isOpen({ closesOn, closedAt }: Closing, today = todayInUK()) {
  return !closedAt && (!closesOn || today <= closesOn);
}

/** "8 December" (the year is added if it isn't this year). */
export function shortDate(date: string, today = todayInUK()) {
  const full = formatDate(date);
  return date.slice(0, 4) === today.slice(0, 4) ? full.replace(/ \d{4}$/, "") : full;
}

/** "12 days left", "1 day left", "Last day today". */
export function daysLeftText(closesOn: string, today = todayInUK()) {
  const days = daysBetween(today, closesOn);
  if (days <= 0) return "last day today";
  return days === 1 ? "1 day left" : `${days} days left`;
}

/**
 * Checks a closing date typed into a form. Returns an error message, or null.
 * `unchanged` allows an existing past date to be kept when editing other details.
 */
export function closingDateProblem(value: string, unchanged = false, today = todayInUK()) {
  if (!value) return null; // no closing date is fine
  if (!isValidDate(value)) return "Please check the closing date.";
  if (unchanged) return null;
  if (value < today) return "The closing date can't be in the past. To stop new memories now, use “Close now” on the book's page.";
  if (value > addDays(today, MAX_DAYS_OPEN)) return "Please choose a closing date within the next year.";
  return null;
}
