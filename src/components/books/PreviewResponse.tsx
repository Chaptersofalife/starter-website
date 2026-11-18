"use client";

// "Approve and print" or "Request changes" for a preview.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PreviewResult } from "@/app/my-books/preview-actions";
import { CHANGES_MESSAGE_MAX } from "@/lib/orders";

type Props = {
  approve: () => Promise<PreviewResult>;
  requestChanges: (message: string) => Promise<PreviewResult>;
};

export default function PreviewResponse({ approve, requestChanges }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"choose" | "confirm-approve" | "changes">("choose");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function run(action: () => Promise<PreviewResult>) {
    setError("");
    startTransition(async () => {
      const res = await action().catch(() => ({ ok: false, error: "Sorry, something went wrong. Please try again." }) as PreviewResult);
      if (!res.ok) {
        setError(res.error ?? "Sorry, that didn't work. Please try again.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="preview-response">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {mode === "choose" && (
        <div className="actions">
          <button type="button" className="button" onClick={() => setMode("confirm-approve")}>
            Approve and print
          </button>
          <button type="button" className="button button-secondary" onClick={() => setMode("changes")}>
            Request changes
          </button>
        </div>
      )}

      {mode === "confirm-approve" && (
        <div className="confirm-panel confirm-panel-gentle" role="alertdialog" aria-labelledby="approve-title">
          <p id="approve-title" className="confirm-title">
            Approve this book for printing?
          </p>
          <p>
            We&rsquo;ll print the book exactly as it appears in this preview. Once approved, the book
            and its memories can&rsquo;t be changed, and no new memories can be added.
          </p>
          <div className="actions">
            <button type="button" className="button" disabled={pending} onClick={() => run(approve)}>
              {pending ? "Approving…" : "Yes, approve and print"}
            </button>
            <button type="button" className="button button-secondary" onClick={() => setMode("choose")} autoFocus>
              Not yet
            </button>
          </div>
        </div>
      )}

      {mode === "changes" && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => requestChanges(message));
          }}
        >
          <div className="field">
            <label htmlFor="changes-message">What would you like changed?</label>
            <textarea
              id="changes-message"
              rows={7}
              maxLength={CHANGES_MESSAGE_MAX}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-describedby="changes-hint"
              required
            />
            <p id="changes-hint" className="field-hint">
              Please mention the page number where you can, for example &ldquo;Page 4: Grandad&rsquo;s name
              is spelt Johnathan&rdquo;. We&rsquo;ll send you an updated preview.
            </p>
          </div>
          <div className="actions">
            <button type="submit" className="button" disabled={pending || !message.trim()}>
              {pending ? "Sending…" : "Send my changes"}
            </button>
            <button type="button" className="button button-secondary" onClick={() => setMode("choose")}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
