"use client";

// Choose the book's style from small cover previews. Saves straight away.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bookStyles } from "@/lib/book-styles";
import BookCover from "./BookCover";

type Props = {
  current: string;
  title: string;
  subtitle?: string;
  /** True once approved for printing: the style can't be changed. */
  readOnly?: boolean;
  save: (styleId: string) => Promise<{ ok: boolean; error?: string }>;
};

export default function BookStylePicker({ current, title, subtitle, readOnly = false, save }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);

  function choose(id: string) {
    if (readOnly || id === selected) return;
    const previous = selected;
    setSelected(id);
    setNote(null);
    startTransition(async () => {
      const res = await save(id).catch(() => ({ ok: false, error: "Sorry, that didn't save. Please try again." }));
      if (!res.ok) {
        setSelected(previous);
        setNote({ text: res.error ?? "Sorry, that didn't save. Please try again.", error: true });
        return;
      }
      setNote({ text: "Saved." });
      router.refresh();
    });
  }

  return (
    <div className="style-picker">
      <div className="style-options" role="radiogroup" aria-label="Book style">
        {bookStyles.map((s) => (
          <label key={s.id} className={`style-option${selected === s.id ? " is-selected" : ""}${readOnly ? " is-readonly" : ""}`}>
            <input
              type="radio"
              name="book_style"
              value={s.id}
              checked={selected === s.id}
              disabled={readOnly || pending}
              onChange={() => choose(s.id)}
              className="visually-hidden"
            />
            <BookCover styleId={s.id} title={title} subtitle={subtitle} />
            <span className="style-name">
              {s.name}
              {selected === s.id && <span className="visually-hidden"> (chosen)</span>}
            </span>
            <span className="style-description">{s.description}</span>
          </label>
        ))}
      </div>
      <p className="field-hint" role="status">
        {note ? <span className={note.error ? "field-error" : undefined}>{note.text}</span> : readOnly ? "The style is fixed now the book is approved." : "You can change the style until you approve your preview."}
      </p>
    </div>
  );
}
