"use client";

// The "Delete this book" button, with an "Are you sure?" step first.

import { useState } from "react";
import { useFormStatus } from "react-dom";

type DeleteBookProps = {
  /** The server action that deletes this book. */
  action: () => Promise<void>;
  bookName: string;
};

export default function DeleteBook({ action, bookName }: DeleteBookProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className="button button-danger-quiet" onClick={() => setConfirming(true)}>
        Delete this book
      </button>
    );
  }

  return (
    <div className="confirm-panel" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-text">
      <p id="confirm-title" className="confirm-title">
        Are you sure you want to delete this book?
      </p>
      <p id="confirm-text">
        The book for <strong>{bookName}</strong> and everything in it will be
        permanently deleted. This can&rsquo;t be undone.
      </p>
      <form action={action} className="actions">
        <ConfirmButton />
        <button
          type="button"
          className="button button-secondary"
          onClick={() => setConfirming(false)}
          autoFocus
        >
          No, keep it
        </button>
      </form>
    </div>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button button-danger" disabled={pending}>
      {pending ? "Deleting…" : "Yes, delete it"}
    </button>
  );
}
