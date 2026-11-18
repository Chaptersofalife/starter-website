"use client";

// Invite people by email, and see who has been invited and who has added a
// memory. Organisers can resend an invitation or remove someone.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { InviteResult } from "@/app/my-books/invitation-actions";
import { MAX_INVITES_PER_SEND, MESSAGE_MAX, parseInviteList } from "@/lib/invitations";

export type InvitedPerson = {
  id: string;
  email: string;
  firstName: string | null;
  /** e.g. "17 Nov" */
  lastSent: string | null;
  sendCount: number;
  contributed: boolean;
  remindersStopped: boolean;
};

type InvitationsPanelProps = {
  open: boolean;
  /** True once approved for printing: the list can't be changed. */
  readOnly?: boolean;
  people: InvitedPerson[];
  actions: {
    send: (list: string, message: string) => Promise<InviteResult>;
    resend: (invitationId: string) => Promise<{ ok: boolean; error?: string }>;
    remove: (invitationId: string) => Promise<{ ok: boolean; error?: string }>;
  };
};

export default function InvitationsPanel({ open, readOnly = false, people, actions }: InvitationsPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<InviteResult | null>(null);
  const [rowNote, setRowNote] = useState<{ id: string; text: string; error?: boolean } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const parsed = parseInviteList(list);
  const contributed = people.filter((p) => p.contributed).length;

  function send(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await actions.send(list, message).catch(
        () => ({ ok: false, error: "Sorry, something went wrong. Please try again." }) as InviteResult,
      );
      setResult(res);
      if (res.ok) {
        setList("");
        router.refresh();
      }
    });
  }

  function rowAction(id: string, run: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setRowNote(null);
    startTransition(async () => {
      const res = await run().catch(() => ({ ok: false, error: "Sorry, something went wrong. Please try again." }));
      setRowNote({ id, text: res.ok ? success : (res.error ?? "Sorry, that didn't work."), error: !res.ok });
      setConfirmRemove(null);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="invitations">
      <h3>Invite by email</h3>
      {readOnly ? null : !open ? (
        <p className="muted">The book is closed. Reopen it to send more invitations.</p>
      ) : (
        <form onSubmit={send} className="form">
          <div className="field">
            <label htmlFor="invite-list">Who would you like to invite?</label>
            <textarea
              id="invite-list"
              rows={5}
              value={list}
              onChange={(e) => setList(e.target.value)}
              placeholder={"Sarah Jones <sarah@example.com>\nTom, tom@example.com\ngrace@example.com"}
              aria-describedby="invite-list-hint"
            />
            <p id="invite-list-hint" className="field-hint">
              One person per line: an email address, with their name if you like. You can paste a
              list straight from your email or contacts. Up to {MAX_INVITES_PER_SEND} at a time.
              {list.trim() && (
                <>
                  {" "}
                  <strong>
                    {parsed.people.length} {parsed.people.length === 1 ? "person" : "people"} found
                  </strong>
                  {parsed.invalid.length > 0 && `, ${parsed.invalid.length} ${parsed.invalid.length === 1 ? "line" : "lines"} without an email address`}
                  .
                </>
              )}
            </p>
          </div>

          <div className="field">
            <label htmlFor="invite-message">
              A personal message <span className="optional">(optional)</span>
            </label>
            <textarea
              id="invite-message"
              rows={4}
              maxLength={MESSAGE_MAX}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-describedby="invite-message-hint"
            />
            <p id="invite-message-hint" className="field-hint">
              Shown in the email, signed with your name. Replies to the email will come to you.
            </p>
          </div>

          {result && (
            <div className={result.ok ? "invite-result" : "form-error"} role={result.ok ? "status" : "alert"}>
              {result.ok && (
                <p>
                  {result.sent
                    ? `Invitations sent to ${result.sent} ${result.sent === 1 ? "person" : "people"}.`
                    : "No new invitations were sent."}
                </p>
              )}
              {result.error && <p>{result.error}</p>}
              {result.alreadyInvited && result.alreadyInvited.length > 0 && (
                <p>
                  Already invited, so not sent again: {result.alreadyInvited.join(", ")}. Use
                  &ldquo;Resend&rdquo; below if you&rsquo;d like to send theirs again.
                </p>
              )}
              {result.invalid && result.invalid.length > 0 && (
                <p>No email address found on: {result.invalid.slice(0, 5).join("; ")}{result.invalid.length > 5 ? "…" : ""}</p>
              )}
            </div>
          )}

          <div>
            <button type="submit" className="button" disabled={pending || parsed.people.length === 0}>
              {pending ? "Sending…" : `Send ${parsed.people.length > 1 ? `${parsed.people.length} invitations` : "invitation"}`}
            </button>
          </div>
        </form>
      )}

      {people.length > 0 && (
        <div className="invited">
          <h4>
            Invited ({people.length}) · {contributed} {contributed === 1 ? "has" : "have"} added a memory
          </h4>
          <ul className="invited-list">
            {people.map((p) => (
              <li key={p.id} className="invited-row">
                <div className="invited-who">
                  <span className="invited-name">{p.firstName ?? p.email}</span>
                  {p.firstName && <span className="invited-email">{p.email}</span>}
                  <span className="invited-meta">
                    {p.lastSent ? `Invited ${p.lastSent}` : "Not sent yet"}
                    {p.sendCount > 1 ? ` (sent ${p.sendCount} times)` : ""}
                  </span>
                </div>
                <div className="invited-status">
                  {p.contributed ? (
                    <span className="open-label">Added a memory</span>
                  ) : (
                    <span className="closed-label">Not yet</span>
                  )}
                  {p.remindersStopped && <span className="invited-meta">Reminders stopped</span>}
                </div>
                <div className="invited-actions" hidden={readOnly}>
                  {confirmRemove === p.id ? (
                    <>
                      <span className="invited-meta">Remove {p.firstName ?? p.email}?</span>
                      <button
                        type="button"
                        className="link-button link-button-danger"
                        disabled={pending}
                        onClick={() => rowAction(p.id, () => actions.remove(p.id), "Removed.")}
                      >
                        Yes, remove
                      </button>
                      <button type="button" className="link-button" onClick={() => setConfirmRemove(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {open && !p.contributed && (
                        <button
                          type="button"
                          className="link-button"
                          disabled={pending}
                          onClick={() => rowAction(p.id, () => actions.resend(p.id), "Invitation sent again.")}
                        >
                          Resend
                        </button>
                      )}
                      <button
                        type="button"
                        className="link-button link-button-danger"
                        disabled={pending}
                        onClick={() => setConfirmRemove(p.id)}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
                {rowNote?.id === p.id && (
                  <p className={rowNote.error ? "field-error invited-note" : "invited-meta invited-note"} role="status">
                    {rowNote.text}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="field-hint">
            Removing someone only takes them off this list. Their link will keep working while
            the book is open, and any memory they&rsquo;ve added is kept.
          </p>
        </div>
      )}
    </div>
  );
}
