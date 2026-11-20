"use client";

// Lets contributors choose up to 2 photos, see a preview of each, add an
// optional caption and rough date, and remove any before sending.
// Works with the phone's photo library or camera.

import { useRef, useState } from "react";
import {
  CAPTION_MAX,
  MAX_PHOTOS_PER_MEMORY,
  TAKEN_MAX,
  acceptAttribute,
} from "@/lib/photos";
import { PhotoError, preparePhoto, type PreparedPhoto } from "@/lib/photos-client";

export type PickedPhoto = {
  key: string;
  fileName: string;
  status: "preparing" | "ready" | "error";
  prepared?: PreparedPhoto;
  error?: string;
  caption: string;
  taken: string;
};

type PhotoPickerProps = {
  photos: PickedPhoto[];
  onChange: (update: (photos: PickedPhoto[]) => PickedPhoto[]) => void;
  disabled?: boolean;
  /** The name to use in the wording, e.g. "Peggy". */
  personName: string;
};

let nextKey = 0;

export default function PhotoPicker({ photos, onChange, disabled, personName }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const remaining = MAX_PHOTOS_PER_MEMORY - photos.length;

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files);
    const toAdd = chosen.slice(0, Math.max(0, remaining));
    setNote(
      chosen.length > toAdd.length
        ? `Each person can share up to ${MAX_PHOTOS_PER_MEMORY} photos, so we've added the first ${toAdd.length}.`
        : "",
    );

    const newItems: PickedPhoto[] = toAdd.map((file) => ({
      key: `photo-${nextKey++}`,
      fileName: file.name,
      status: "preparing",
      caption: "",
      taken: "",
    }));
    onChange((current) => [...current, ...newItems]);

    // Prepare one at a time, which is kinder to phones' memory.
    (async () => {
      for (const [i, file] of toAdd.entries()) {
        const key = newItems[i].key;
        try {
          const prepared = await preparePhoto(file);
          onChange((current) => {
            if (!current.some((p) => p.key === key)) {
              URL.revokeObjectURL(prepared.previewUrl); // removed while preparing
              return current;
            }
            return current.map((p) => (p.key === key ? { ...p, status: "ready", prepared } : p));
          });
        } catch (e) {
          const message =
            e instanceof PhotoError ? e.message : `We couldn't open “${file.name}”. Please try a different photo.`;
          onChange((current) =>
            current.map((p) => (p.key === key ? { ...p, status: "error", error: message } : p)),
          );
        }
      }
    })();
  }

  function remove(key: string) {
    onChange((current) => {
      const photo = current.find((p) => p.key === key);
      if (photo?.prepared) URL.revokeObjectURL(photo.prepared.previewUrl);
      return current.filter((p) => p.key !== key);
    });
    setNote("");
  }

  function update(key: string, field: "caption" | "taken", value: string) {
    onChange((current) => current.map((p) => (p.key === key ? { ...p, [field]: value } : p)));
  }

  return (
    <div className="photo-picker">
      <div className="photo-picker-head">
        <p className="photo-picker-label" id="photos-label">
          Photos <span className="optional">(optional, up to {MAX_PHOTOS_PER_MEMORY} per person)</span>
        </p>
        <p className="field-hint" id="photos-hint">
          Photos of {personName}, or of times you shared. JPG, PNG and iPhone photos all work.
        </p>
      </div>

      {photos.length > 0 && (
        <ul className="photo-list" aria-labelledby="photos-label">
          {photos.map((photo, index) => (
            <li key={photo.key} className="photo-card">
              <div className="photo-preview">
                {photo.status === "ready" && photo.prepared ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen file
                  <img src={photo.prepared.previewUrl} alt={`Photo ${index + 1} preview`} />
                ) : photo.status === "preparing" ? (
                  <span className="photo-preparing" role="status">
                    Preparing…
                  </span>
                ) : (
                  <span className="photo-preparing">Can&rsquo;t be used</span>
                )}
              </div>

              <div className="photo-details">
                {photo.status === "error" ? (
                  <p className="field-error">{photo.error}</p>
                ) : (
                  <>
                    {photo.prepared?.warning && (
                      <p className="photo-warning">{photo.prepared.warning}</p>
                    )}
                    <div className="field">
                      <label htmlFor={`${photo.key}-caption`}>
                        Caption <span className="optional">(optional)</span>
                      </label>
                      <input
                        id={`${photo.key}-caption`}
                        type="text"
                        maxLength={CAPTION_MAX}
                        value={photo.caption}
                        onChange={(e) => update(photo.key, "caption", e.target.value)}
                        disabled={disabled}
                        placeholder="Who or what is in the photo?"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`${photo.key}-taken`}>
                        Roughly when <span className="optional">(optional)</span>
                      </label>
                      <input
                        id={`${photo.key}-taken`}
                        type="text"
                        maxLength={TAKEN_MAX}
                        value={photo.taken}
                        onChange={(e) => update(photo.key, "taken", e.target.value)}
                        disabled={disabled}
                        placeholder="For example, Summer 1975"
                      />
                    </div>
                  </>
                )}
                <button
                  type="button"
                  className="photo-remove"
                  onClick={() => remove(photo.key)}
                  disabled={disabled}
                >
                  Remove<span className="visually-hidden"> photo {index + 1}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {note && (
        <p className="field-hint" role="status">
          {note}
        </p>
      )}

      {remaining > 0 && (
        <div>
          <input
            ref={inputRef}
            id="photo-input"
            type="file"
            accept={acceptAttribute}
            multiple
            className="visually-hidden"
            aria-describedby="photos-hint"
            disabled={disabled}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = ""; // so the same photo can be chosen again
            }}
          />
          <label htmlFor="photo-input" className="button button-secondary photo-add">
            {photos.length === 0 ? "Add photos" : "Add more photos"}
          </label>
          {photos.length > 0 && (
            <span className="photo-count">
              {photos.length} of {MAX_PHOTOS_PER_MEMORY}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
