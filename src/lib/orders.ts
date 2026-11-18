// Prices, product details and order statuses (used by the browser and server).
// Change prices here. The server always works out the total from these,
// so the price shown on the page can't be changed by the visitor.

export const PRODUCT_NAME = "Keepsake book";
export const PRODUCT_DESCRIPTION = "A 32-page A4 hardback memorial book, with UK delivery included.";
export const BOOK_PRICE_PENCE = 5999; // £59.99, including UK delivery
export const EXTRA_COPY_PENCE = 2999; // £29.99 each
export const MAX_EXTRA_COPIES = 10;
/** Working days until the organiser receives a preview to approve. */
export const PREVIEW_WORKING_DAYS = 5;

export function orderTotalPence(extraCopies: number) {
  return BOOK_PRICE_PENCE + extraCopies * EXTRA_COPY_PENCE;
}

/** 5999 → "£59.99" */
export function formatPounds(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export type OrderStatus =
  | "awaiting_payment"
  | "payment_failed"
  | "expired"
  | "paid"
  | "preview_sent"
  | "changes_requested"
  | "approved"
  | "sent_to_printer"
  | "dispatched"
  | "delivered"
  | "refunded";

/** What each status is called on the website. */
export const orderStatusLabels: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  payment_failed: "Payment didn't go through",
  expired: "Not paid",
  paid: "Paid – being designed",
  preview_sent: "Preview sent",
  changes_requested: "Changes requested",
  approved: "Approved",
  sent_to_printer: "Sent to printer",
  dispatched: "Dispatched",
  delivered: "Delivered",
  refunded: "Refunded",
};

/** The statuses the admin can choose from, in order. */
export const adminStatusChoices: OrderStatus[] = [
  "paid",
  "preview_sent",
  "changes_requested",
  "approved",
  "sent_to_printer",
  "dispatched",
  "delivered",
];

/** Orders that have been paid for (shown to the organiser and admin). */
export const paidStatuses: OrderStatus[] = [...adminStatusChoices, "refunded"];

/** A UK postcode, e.g. "SW1A 1AA", "M1 1AE", "B33 8TH". */
export function normalisePostcode(value: string) {
  const compact = value.toUpperCase().replace(/\s+/g, "");
  if (!/^([A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}|GIR0AA)$/.test(compact)) return null;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export type DeliveryAddress = {
  delivery_name: string;
  address_line1: string;
  address_line2: string;
  town: string;
  county: string;
  postcode: string;
  phone: string;
};

/** One address on several lines, for emails and lists. */
export function addressLines(o: Partial<Record<keyof DeliveryAddress, string | null>>) {
  return [o.delivery_name, o.address_line1, o.address_line2, o.town, o.county, o.postcode, "United Kingdom"].filter(
    (line): line is string => Boolean(line && line.trim()),
  );
}

/** Orders whose preview can be replaced with a new version. */
export const previewableStatuses: OrderStatus[] = ["paid", "preview_sent", "changes_requested"];

/** The private bucket for preview PDFs. */
export const PREVIEW_BUCKET = "book-previews";
/** Largest preview PDF accepted (Supabase's free plan allows up to 50 MB per file). */
export const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;
export const CHANGES_MESSAGE_MAX = 2000;
