"use client";

// One memory on the organiser's book page, with everything needed to review
// it: approve or hide, correct the text (with undo), hide single photos, or
// delete it.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { MemoryStatus, ReviewResult } from "@/app/my-books/review-actions";
import PhotoGallery, { type GalleryPhoto } from "@/components/books/PhotoGallery";
import { memoryLimits } from "@/lib/invites";

export type ReviewMemory = {
  id: string;
  contributorName: string;
  contributorEmail: string;
  relationship: string;
  /** "17 November 2026 at 14:05" */
  sentAt: string;
  status: MemoryStatus;
  /** What the contributor wrote. Never changed. */
  originalMemory: string;
  originalSayings: string | null;
  /** The organiser's corrections, if any. */
  editedMemory: string | null;
  editedSayings: string | null;
  photos: GalleryPhoto[];
};

type MemoryReviewProps = {
  memory: ReviewMemory;
  /** True once approved for printing: nothing can be changed. */
  readOnly?: boolean;
  actions: {
    setStatus: (memoryId: string, status: MemoryStatus) => Promise<ReviewResult>;
    saveEdit: (
      memoryId: string,
      text: { memory: string; sayings: string },
      original: { memory: string; sayings: string | null },
    ) => Promise<ReviewResult>;
    undoEdit: (memoryId: string) => Promise<ReviewResult>;
    setPhotoHidden: (photoId: string, hidden: boolean) => Promise<ReviewResult>;
    deleteMemory: (memoryId: string) => Promise<ReviewResult>;
    getDownloadUrl: (photoId: string) => Promise<string | null>;
  };
};

const statusLabels: Record<MemoryStatus, string> = {
  waiting: "Waiting for review",
  approved: "Approved",
  hidden: "Hidden",
};

export default function MemoryReview({ memory, actions, readOnly = false }: MemoryReviewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete" | "confirm-undo">("view");
  const [showOriginal, setShowOriginal] = useState(false);

  const isEdited = memory.editedMemory !== null || memory.editedSayings !== null;
  const shownMemory = memory.editedMemory ?? memory.originalMemory;
  const shownSayings = memory.editedSayings ?? memory.originalSayings;

  /** Runs a change, then reloads the page's details. */
  function run(change: () => Promise<ReviewResult>, after?: () => void) {
    setError("");
    startTransition(async () => {
      const result = await change().catch(() => ({ ok: false, error: undefined }) as ReviewResult);
      if (!result.ok) {
        setError(result.error ?? "Sorry, that didn't save. Please try again.");
        return;
      }
      after?.();
      router.refresh();
    });
  }

  return (
    <article className={`review-card review-${memory.status}`} aria-labelledby={`memory-${memory.id}-name`}>
      <header className="review-header">
        <div className="review-who">
          <p id={`memory-${memory.id}-name`} className="review-name">
            {memory.contributorName}
          </p>
          <p className="review-meta">
            {memory.relationship}
            <span aria-hidden="true"> · </span>
            <a href={`mailto:${memory.contributorEmail}`}>{memory.contributorEmail}</a>
          </p>
          <p className="review-meta">Sent {memory.sentAt}</p>
        </div>
        <p className={`status-badge status-${memory.status}`}>{statusLabels[memory.status]}</p>
      </header>

      {mode === "edit" ? (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            run(
              () =>
                actions.saveEdit(
                  memory.id,
                  { memory: String(data.get("memory") ?? ""), sayings: String(data.get("sayings") ?? "") },
                  { memory: memory.originalMemory, sayings: memory.originalSayings },
                ),
              () => setMode("view"),
            );
          }}
        >
          <p className="field-hint">
            Correct spelling or typos. {memory.contributorName.split(/\s+/)[0]}&rsquo;s original words are
            kept, so you can undo this at any time.
          </p>
          <div className="field">
            <label htmlFor={`edit-${memory.id}-memory`}>Memory</label>
            <textarea
              id={`edit-${memory.id}-memory`}
              name="memory"
              rows={10}
              maxLength={memoryLimits.memory}
              defaultValue={shownMemory}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`edit-${memory.id}-sayings`}>
              Favourite sayings <span className="optional">(optional)</span>
            </label>
            <textarea
              id={`edit-${memory.id}-sayings`}
              name="sayings"
              rows={3}
              maxLength={memoryLimits.sayings}
              defaultValue={shownSayings ?? ""}
            />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit" className="button" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button type="button" className="button button-secondary" onClick={() => setMode("view")}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {isEdited && (
            <div className="edited-note">
              <span>You edited this memory.</span>
              <button type="button" className="link-button" onClick={() => setShowOriginal((s) => !s)}>
                {showOriginal ? "Show my edited version" : "Show original"}
              </button>
            </div>
          )}

          {showOriginal && isEdited ? (
            <div className="original-text" aria-label="The original memory">
              <p className="original-label">Original, as {memory.contributorName.split(/\s+/)[0]} wrote it</p>
              <p className="review-text">{memory.originalMemory}</p>
              {memory.originalSayings && (
                <blockquote className="review-sayings">
                  <p className="review-sayings-label">Favourite sayings</p>
                  <p className="review-text">{memory.originalSayings}</p>
                </blockquote>
              )}
            </div>
          ) : (
            <>
              <p className="review-text">{shownMemory}</p>
              {shownSayings && (
                <blockquote className="review-sayings">
                  <p className="review-sayings-label">Favourite sayings</p>
                  <p className="review-text">{shownSayings}</p>
                </blockquote>
              )}
            </>
          )}
        </>
      )}

      {memory.photos.length > 0 && (
        <PhotoGallery
          photos={memory.photos}
          contributorName={memory.contributorName}
          getDownloadUrl={actions.getDownloadUrl}
          onToggleHidden={readOnly ? undefined : (photoId, hidden) => run(() => actions.setPhotoHidden(photoId, hidden))}
          busy={pending}
        />
      )}

      {mode !== "edit" && error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {mode === "confirm-delete" && (
        <div className="confirm-panel" role="alertdialog" aria-labelledby={`del-${memory.id}`}>
          <p id={`del-${memory.id}`} className="confirm-title">
            Delete this memory?
          </p>
          <p>
            {memory.contributorName}&rsquo;s memory
            {memory.photos.length > 0 ? ` and ${memory.photos.length === 1 ? "photo" : `${memory.photos.length} photos`}` : ""} will
            be permanently deleted. This can&rsquo;t be undone. If you just want to leave it out of the
            book, choose Hide instead.
          </p>
          <div className="actions">
            <button
              type="button"
              className="button button-danger"
              disabled={pending}
              onClick={() => run(() => actions.deleteMemory(memory.id))}
            >
              {pending ? "Deleting…" : "Yes, delete it"}
            </button>
            <button type="button" className="button button-secondary" onClick={() => setMode("view")} autoFocus>
              No, keep it
            </button>
          </div>
        </div>
      )}

      {mode === "confirm-undo" && (
        <div className="confirm-panel confirm-panel-gentle" role="alertdialog" aria-labelledby={`undo-${memory.id}`}>
          <p id={`undo-${memory.id}`} className="confirm-title">
            Undo your edits?
          </p>
          <p>The memory will go back to exactly what {memory.contributorName.split(/\s+/)[0]} wrote.</p>
          <div className="actions">
            <button
              type="button"
              className="button"
              disabled={pending}
              onClick={() => run(() => actions.undoEdit(memory.id), () => {
                setMode("view");
                setShowOriginal(false);
              })}
            >
              {pending ? "Undoing…" : "Yes, undo my edits"}
            </button>
            <button type="button" className="button button-secondary" onClick={() => setMode("view")} autoFocus>
              Keep my edits
            </button>
          </div>
        </div>
      )}

      {mode === "view" && !readOnly && (
        <div className="review-actions">
          <div className="review-decision" role="group" aria-label="Review decision">
            {memory.status !== "approved" && (
              <button
                type="button"
                className="button"
                disabled={pending}
                onClick={() => run(() => actions.setStatus(memory.id, "approved"))}
              >
                Approve
              </button>
            )}
            {memory.status !== "hidden" && (
              <button
                type="button"
                className="button button-secondary"
                disabled={pending}
                onClick={() => run(() => actions.setStatus(memory.id, "hidden"))}
              >
                Hide
              </button>
            )}
            {memory.status !== "waiting" && (
              <button
                type="button"
                className="link-button"
                disabled={pending}
                onClick={() => run(() => actions.setStatus(memory.id, "waiting"))}
              >
                Move back to waiting
              </button>
            )}
          </div>
          <div className="review-more">
            <button type="button" className="link-button" onClick={() => { setError(""); setMode("edit"); }}>
              Edit text
            </button>
            {isEdited && (
              <button type="button" className="link-button" onClick={() => setMode("confirm-undo")}>
                Undo my edits
              </button>
            )}
            <button type="button" className="link-button link-button-danger" onClick={() => setMode("confirm-delete")}>
              Delete memory
            </button>
          </div>
          {pending && (
            <p className="review-saving" role="status">
              Saving…
            </p>
          )}
        </div>
      )}
    </article>
  );
}
