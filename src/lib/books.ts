// Shared details about books: what a book contains, the limits on each
// field, and how dates are shown.

export type Book = {
  id: string;
  full_name: string;
  known_as: string | null;
  date_of_birth: string | null; // "YYYY-MM-DD"
  date_of_death: string | null; // "YYYY-MM-DD"
  lived_in: string | null;
  introduction: string | null;
  created_at: string;
  updated_at: string;
};

/** The columns to load for a book. */
export const bookColumns =
  "id, full_name, known_as, date_of_birth, date_of_death, lived_in, introduction, created_at, updated_at";

/** Longest each answer can be (the database checks these too). */
export const limits = {
  full_name: 200,
  known_as: 100,
  lived_in: 200,
  introduction: 2000,
} as const;

/** Earliest date the form accepts, to catch typing mistakes like "0024". */
export const earliestDate = "1800-01-01";

/** Today's date in the UK, as "YYYY-MM-DD". */
export function todayInUK() {
  // The "en-CA" format happens to be YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

/** True if text is a real calendar date written as YYYY-MM-DD. */
export function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** "1941-03-12" becomes "12 March 1941". */
export function formatDate(value: string | null) {
  if (!value || !isValidDate(value)) return "";
  const [y, m, d] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "12 March 1941 – 3 June 2024" */
export function lifeDates(book: Pick<Book, "date_of_birth" | "date_of_death">) {
  return [formatDate(book.date_of_birth), formatDate(book.date_of_death)]
    .filter(Boolean)
    .join(" – ");
}

/** True if text looks like a book ID (so we never send nonsense to the database). */
export function isBookId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
