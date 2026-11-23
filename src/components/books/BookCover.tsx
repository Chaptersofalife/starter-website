// A small picture of the printed book's cover in a chosen style.
// The colours are the book's own (from src/lib/book-styles.ts), not the
// website's, so they're set here directly.

import { bookStyle } from "@/lib/book-styles";

type BookCoverProps = {
  styleId: string;
  /** The name on the cover, e.g. "Margaret Rose Ellis" */
  title: string;
  /** e.g. "1938 – 2026" */
  subtitle?: string;
  size?: "small" | "medium";
};

export default function BookCover({ styleId, title, subtitle, size = "small" }: BookCoverProps) {
  const s = bookStyle(styleId);
  return (
    <span
      className={`book-cover book-cover-${size}`}
      style={{ background: s.cover, color: s.text }}
      aria-hidden="true"
    >
      <span className="book-cover-spine" style={{ background: s.accent }} />
      <span className="book-cover-line" style={{ background: s.accent }} />
      <span className="book-cover-title">{title}</span>
      {subtitle && <span className="book-cover-subtitle">{subtitle}</span>}
      <span className="book-cover-line" style={{ background: s.accent }} />
    </span>
  );
}
