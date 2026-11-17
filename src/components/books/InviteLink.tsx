"use client";

// The private invite link on a book's page, with "Copy link" and
// "Create new link" (which turns the old link off).

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type InviteLinkProps = {
  url: string;
  /** The server action that replaces the link. */
  createNewLink: () => Promise<void>;
};

export default function InviteLink({ url, createNewLink }: InviteLinkProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<"" | "copied" | "select">("");
  const [confirming, setConfirming] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("copied");
    } catch {
      // Some browsers block copying: select the link so it can be copied by hand.
      inputRef.current?.select();
      setCopied("select");
    }
    window.setTimeout(() => setCopied(""), 4000);
  }

  return (
    <div className="invite">
      <label htmlFor="invite-link" className="invite-label">
        Your private link
      </label>
      <div className="invite-row">
        <input
          ref={inputRef}
          id="invite-link"
          type="text"
          value={url}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" className="button" onClick={copy}>
          {copied === "copied" ? "Copied ✓" : "Copy link"}
        </button>
      </div>
      <p className="invite-status" role="status">
        {copied === "copied" && "Link copied. You can now paste it into an email or message."}
        {copied === "select" && "The link is selected. Press Cmd + C (or Ctrl + C) to copy it."}
      </p>

      {!confirming ? (
        <button type="button" className="button button-secondary" onClick={() => setConfirming(true)}>
          Create new link
        </button>
      ) : (
        <div className="confirm-panel confirm-panel-gentle" role="alertdialog" aria-labelledby="newlink-title" aria-describedby="newlink-text">
          <p id="newlink-title" className="confirm-title">
            Create a new link?
          </p>
          <p id="newlink-text">
            The current link will stop working straight away. Anyone who
            hasn&rsquo;t shared their memory yet will need the new link. Memories
            already received are kept.
          </p>
          <form action={createNewLink} className="actions">
            <ConfirmButton />
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setConfirming(false)}
              autoFocus
            >
              Keep the current link
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button" disabled={pending}>
      {pending ? "Creating…" : "Yes, create a new link"}
    </button>
  );
}
