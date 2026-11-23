// The book styles organisers can choose from (cover colours for the printed
// book). To change a style's colours or name, edit it here. If you add or
// rename one, also update the list in the database (see
// supabase/migrations/20261123_book_styles.sql).

export type BookStyleId = "evergreen" | "deep_sea" | "soft_lavender" | "charcoal_linen";

export type BookStyle = {
  id: BookStyleId;
  name: string;
  /** Cover colour */
  cover: string;
  /** Colour of the title and words on the cover */
  text: string;
  /** Thin lines and small details on the cover */
  accent: string;
  /** A few words to help people choose */
  description: string;
};

export const bookStyles: BookStyle[] = [
  {
    id: "evergreen",
    name: "Evergreen",
    cover: "#52796F",
    text: "#F8F6F1",
    accent: "#84A98C",
    description: "Calm deep teal, our signature style.",
  },
  {
    id: "deep_sea",
    name: "Deep sea",
    cover: "#1B263B",
    text: "#E0E1DD",
    accent: "#415A77",
    description: "Rich navy, quiet and classic.",
  },
  {
    id: "soft_lavender",
    name: "Soft lavender",
    cover: "#F2E9E4",
    text: "#22223B",
    accent: "#9A8C98",
    description: "Gentle and light, with a touch of lavender.",
  },
  {
    id: "charcoal_linen",
    name: "Charcoal and linen",
    cover: "#EFEBE4",
    text: "#2F3E46",
    accent: "#C9ADA7",
    description: "Warm linen with soft charcoal lettering.",
  },
];

export const DEFAULT_BOOK_STYLE: BookStyleId = "evergreen";

export function bookStyle(id: string | null | undefined): BookStyle {
  return bookStyles.find((s) => s.id === id) ?? bookStyles[0];
}

export function isBookStyleId(id: string): id is BookStyleId {
  return bookStyles.some((s) => s.id === id);
}
