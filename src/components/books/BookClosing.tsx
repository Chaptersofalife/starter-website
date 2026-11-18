"use client";

// The closing date on a book's page: shows when memories are welcome until,
// and lets the organiser change the date, close early, or reopen.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ClosingResult } from "@/app/my-books/actions";
import { todayInUK } from "@/lib/books";
import { SUGGESTED_DAYS_OPEN, addDays } from "@/lib/closing";

type BookClosingProps = {
  open: boolean;
  /** The closing date ("YYYY-MM-DD"), or null. */
  closesOn: string | null;
  /** e.g. "Memories welcome until 8 December 2026 (12 days left)" */
  headline: string;
  /** A second line, e.g. "You closed this book early on 20 November 2026." */
  detail: string | null;
  /** True once approved for printing: nothing can be changed. */
  locked?: boolean;
  actions: {
    setDate: (closesOn: string) => Promise<ClosingResult>;
    closeNow: () => Promise<ClosingResult>;
    reopen: (closesOn: string) => Promise<ClosingResult>;
  };
};

export default function BookClosing({ open, closesOn, headline, detail, locked = false, actions }: BookClosingProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"view" | "change" | "confirm-close" | "reopen">("view");
  const [error, setError] = useState("");
  const [date, setDate] = useState("");

  function run(change: () => Promise<ClosingResult>) {
    setError("");
    startTransition(async () => {
      const result = await change().catch(() => ({ ok: false }) as ClosingResult);
      if (!result.ok) {
        setError(result.error ?? "Sorry, that didn't save. Please try again.");
        return;
      }
      setMode("view");
      router.refresh();
    });
  }

  const suggested = () => addDays(todayInUK(), SUGGESTED_DAYS_OPEN);

  return (
    <div className={`closing closing-${open ? "open" : "closed"}`}>
      <p className="closing-badge">{open ? "Open for memories" : "Closed to new memories"}</p>
      <p className="closing-headline">{headline}</p>
      {detail && <p className="closing-detail">{detail}</p>}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {mode === "view" && !locked && (
        <div className="actions">
          {open ? (
            <>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setDate(closesOn ?? suggested());
                  setError("");
                  setMode("change");
                }}
              >
                {closesOn ? "Change date" : "Set a closing date"}
              </button>
              <button type="button" className="button button-danger-quiet" onClick={() => setMode("confirm-close")}>
                Close now
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button"
              onClick={() => {
                setDate(suggested());
                setError("");
                setMode("reopen");
              }}
            >
              Reopen
            </button>
          )}
        </div>
      )}

      {(mode === "change" || mode === "reopen") && (
        <form
          className="closing-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => (mode === "change" ? actions.setDate(date) : actions.reopen(date)));
          }}
        >
          <div className="field">
            <label htmlFor="closing-date">
              {mode === "reopen" ? "Welcome memories until" : "New closing date"}
            </label>
            <input
              id="closing-date"
              type="date"
              value={date}
              min={todayInUK()}
              onChange={(e) => setDate(e.target.value)}
            />
            <p className="field-hint">
              Memories are welcome until the end of this day. Leave it empty for no closing date.
            </p>
          </div>
          <div className="actions">
            <button type="submit" className="button" disabled={pending}>
              {pending ? "Saving…" : mode === "reopen" ? "Reopen the book" : "Save date"}
            </button>
            <button type="button" className="button button-secondary" onClick={() => setMode("view")}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === "confirm-close" && (
        <div className="confirm-panel confirm-panel-gentle" role="alertdialog" aria-labelledby="close-now-title">
          <p id="close-now-title" className="confirm-title">
            Close the book now?
          </p>
          <p>
            Family and friends won&rsquo;t be able to add new memories or photos. Everything already
            received is kept, and you can reopen the book at any time.
          </p>
          <div className="actions">
            <button type="button" className="button" disabled={pending} onClick={() => run(actions.closeNow)}>
              {pending ? "Closing…" : "Yes, close it now"}
            </button>
            <button type="button" className="button button-secondary" onClick={() => setMode("view")} autoFocus>
              Keep it open
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
