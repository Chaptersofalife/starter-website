"use client";

// The cover photo on a book's page: upload, change or remove it.
// The original file is kept untouched for printing.

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CoverUpload } from "@/app/my-books/actions";
import { acceptAttribute } from "@/lib/photos";
import { PhotoError, preparePhoto, uploadPhotoFiles } from "@/lib/photos-client";

type Paths = { original: string; display: string; thumb: string };

type CoverPhotoProps = {
  bookName: string;
  /** A viewing link for the current cover, or null if there isn't one. */
  coverUrl: string | null;
  /** A gentle "may look soft in print" message for the current cover. */
  warning: string | null;
  prepareUpload: (info: { mime: string; size: number }) => Promise<CoverUpload>;
  save: (paths: Paths, size: { width: number; height: number }) => Promise<{ ok: boolean; error?: string }>;
  remove: () => Promise<{ ok: boolean; error?: string }>;
  abandon: (paths: Paths) => Promise<void>;
  /** True once approved for printing: the cover can't be changed. */
  readOnly?: boolean;
};

export default function CoverPhoto({
  bookName,
  coverUrl,
  warning,
  prepareUpload,
  save,
  remove,
  abandon,
  readOnly = false,
}: CoverPhotoProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "preparing" | "uploading" | "removing">("");
  const [error, setError] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy("preparing");
    let paths: Paths | null = null;
    try {
      const photo = await preparePhoto(file);
      URL.revokeObjectURL(photo.previewUrl);
      const pass = await prepareUpload({ mime: photo.mime, size: photo.original.size });
      if (!pass.ok) throw new PhotoError(pass.error);
      paths = {
        original: pass.targets.original.path,
        display: pass.targets.display.path,
        thumb: pass.targets.thumb.path,
      };
      setBusy("uploading");
      await uploadPhotoFiles(photo, pass.targets);
      const saved = await save(paths, { width: photo.width, height: photo.height });
      if (!saved.ok) throw new PhotoError(saved.error ?? "The photo couldn't be saved. Please try again.");
      router.refresh();
    } catch (e) {
      if (paths) await abandon(paths).catch(() => {});
      setError(
        e instanceof PhotoError
          ? e.message
          : "The photo couldn't be uploaded. Please check your connection and try again.",
      );
    } finally {
      setBusy("");
    }
  }

  async function confirmRemove() {
    setBusy("removing");
    setError("");
    const result = await remove().catch(() => ({ ok: false, error: undefined }));
    setBusy("");
    setConfirmingRemove(false);
    if (!result.ok) {
      setError(result.error ?? "The photo couldn't be removed. Please try again.");
      return;
    }
    router.refresh();
  }

  const working = busy !== "";

  return (
    <div className="cover-photo">
      <div className="cover-frame">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- private link that expires; not cached by Next.js
          <img src={coverUrl} alt={`Cover photograph of ${bookName}`} />
        ) : (
          <span className="cover-empty">No cover photo yet</span>
        )}
      </div>

      {readOnly ? null : (
      <div className="cover-controls">
        {warning && <p className="photo-warning">{warning}</p>}

        <p className="cover-status" role="status">
          {busy === "preparing" && "Preparing your photo…"}
          {busy === "uploading" && "Uploading… please keep this page open."}
          {busy === "removing" && "Removing…"}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!confirmingRemove ? (
          <div className="actions">
            <input
              id="cover-input"
              type="file"
              accept={acceptAttribute}
              className="visually-hidden"
              disabled={working}
              onChange={(e) => {
                choose(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <label
              htmlFor="cover-input"
              className={`button${coverUrl ? " button-secondary" : ""}`}
              aria-disabled={working || undefined}
            >
              {coverUrl ? "Change photo" : "Add a cover photo"}
            </label>
            {coverUrl && (
              <button
                type="button"
                className="button button-danger-quiet"
                onClick={() => setConfirmingRemove(true)}
                disabled={working}
              >
                Remove photo
              </button>
            )}
          </div>
        ) : (
          <div className="confirm-panel confirm-panel-gentle" role="alertdialog" aria-labelledby="cover-remove-title">
            <p id="cover-remove-title" className="confirm-title">
              Remove the cover photo?
            </p>
            <p>The photo will be deleted. You can add another at any time.</p>
            <div className="actions">
              <button type="button" className="button button-danger" onClick={confirmRemove} disabled={working}>
                {busy === "removing" ? "Removing…" : "Yes, remove it"}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setConfirmingRemove(false)}
                autoFocus
              >
                Keep it
              </button>
            </div>
          </div>
        )}
        <p className="field-hint">
          JPG, PNG or iPhone photos. We keep the original at full quality for printing.
        </p>
      </div>
      )}
    </div>
  );
}
