"use client";

// Admin-only buttons for testing reminder emails.

import { useState, useTransition } from "react";
import type { ReminderReport } from "@/lib/reminders";

/** "Send reminders now (test)": runs the real daily check straight away. */
export function RunRemindersButton({
  run,
}: {
  run: () => Promise<ReminderReport | { error: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReminderReport | { error: string } | null>(null);

  return (
    <div className="layout-download">
      <button
        type="button"
        className="button button-secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await run().catch(() => ({ error: "Something went wrong. Please try again." })));
          })
        }
      >
        {pending ? "Checking…" : "Send reminders now (test)"}
      </button>
      <p className="field-hint">
        Runs today&rsquo;s reminder check straight away, exactly as the daily run would. It only
        emails people who are due a reminder today, and never sends the same reminder twice.
      </p>
      {result && (
        <p className={"error" in result ? "form-error" : "admin-status"} role="status">
          {"error" in result
            ? result.error
            : `Checked ${result.booksChecked} ${result.booksChecked === 1 ? "book" : "books"}: sent ${result.remindersSent} ${result.remindersSent === 1 ? "reminder" : "reminders"} and ${result.organiserEmailsSent} organiser ${result.organiserEmailsSent === 1 ? "email" : "emails"}` +
              (result.failed ? `; ${result.failed} failed` : "") +
              (result.notes.length ? `. ${result.notes.join(" ")}` : ".")}
        </p>
      )}
    </div>
  );
}

/** "Email me a sample of every email" for one book. */
export function TestEmailsButton({ send }: { send: () => Promise<{ ok: boolean; message: string }> }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div className="layout-download">
      <button
        type="button"
        className="button button-secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await send().catch(() => ({ ok: false, message: "Something went wrong. Please try again." })));
          })
        }
      >
        {pending ? "Sending…" : "Email me a sample of every email"}
      </button>
      <p className="field-hint">
        Sends you the invitation, both reminders, the organiser&rsquo;s summary and the
        &ldquo;book closed&rdquo; email for this book, marked [TEST]. Nobody else is emailed and
        nothing is changed.
      </p>
      {result && (
        <p className={result.ok ? "admin-status" : "form-error"} role="status">
          {result.message}
        </p>
      )}
    </div>
  );
}
