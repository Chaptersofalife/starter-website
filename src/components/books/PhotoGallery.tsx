"use client";

// A memory's photos as thumbnails. Clicking one opens it full size, with its
// caption, arrows to move between photos, and "Download original".
// The organiser can also hide single photos from the book.

import { useRef, useState } from "react";

export type GalleryPhoto = {
  id: string;
  thumbUrl: string | null;
  displayUrl: string | null;
  caption: string | null;
  taken: string | null;
  width: number | null;
  height: number | null;
  warning: string | null;
  /** Hidden photos are kept, but won't go in the book. */
  hidden?: boolean;
};

type PhotoGalleryProps = {
  photos: GalleryPhoto[];
  contributorName: string;
  /** Gets a one-hour download link for the original, full-quality file. */
  getDownloadUrl: (photoId: string) => Promise<string | null>;
  /** Hides a photo from the book, or shows it again. */
  onToggleHidden?: (photoId: string, hidden: boolean) => void;
  /** True while a change is saving. */
  busy?: boolean;
};

export default function PhotoGallery({
  photos,
  contributorName,
  getDownloadUrl,
  onToggleHidden,
  busy,
}: PhotoGalleryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const open = (i: number) => {
    setIndex(i);
    setDownloadError("");
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();
  const step = (by: number) => {
    setDownloadError("");
    setIndex((i) => (i + by + photos.length) % photos.length);
  };

  async function download(photoId: string) {
    setDownloading(true);
    setDownloadError("");
    const url = await getDownloadUrl(photoId).catch(() => null);
    setDownloading(false);
    if (url) {
      window.location.href = url; // the link tells the browser to save the file
    } else {
      setDownloadError("Sorry, the original couldn't be downloaded just now. Please try again.");
    }
  }

  const current = photos[index];
  const label = (photo: GalleryPhoto, i: number) =>
    photo.caption ? photo.caption : `Photo ${i + 1} from ${contributorName}`;

  return (
    <>
      <ul className="gallery">
        {photos.map((photo, i) => (
          <li key={photo.id} className={photo.hidden ? "gallery-hidden" : undefined}>
            <button type="button" className="gallery-thumb" onClick={() => open(i)}>
              {photo.hidden && <span className="gallery-hidden-label">Hidden</span>}
              {photo.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- private link that expires; not cached by Next.js
                <img src={photo.thumbUrl} alt="" loading="lazy" />
              ) : (
                <span className="cover-empty">Photo</span>
              )}
              <span className="visually-hidden">Open {label(photo, i)} full size</span>
            </button>
            {(photo.caption || photo.taken) && (
              <p className="gallery-caption">
                {photo.caption}
                {photo.caption && photo.taken ? " · " : ""}
                {photo.taken && <span className="gallery-taken">{photo.taken}</span>}
              </p>
            )}
            {onToggleHidden && (
              <button
                type="button"
                className="link-button gallery-toggle"
                disabled={busy}
                onClick={() => onToggleHidden(photo.id, !photo.hidden)}
              >
                {photo.hidden ? "Show in book" : "Hide from book"}
                <span className="visually-hidden"> (photo {i + 1})</span>
              </button>
            )}
          </li>
        ))}
      </ul>

      <dialog ref={dialogRef} className="lightbox" aria-label={`Photos from ${contributorName}`}>
        {current && (
          <div className="lightbox-inner">
            <div className="lightbox-image">
              {current.displayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- private link that expires; not cached by Next.js
                <img src={current.displayUrl} alt={label(current, index)} />
              ) : (
                <p className="muted">This photo can&rsquo;t be shown just now.</p>
              )}
            </div>
            <div className="lightbox-info">
              <div>
                {current.caption && <p className="lightbox-caption">{current.caption}</p>}
                <p className="muted">
                  {[current.taken, current.width && current.height ? `${current.width} × ${current.height} pixels` : null]
                    .filter(Boolean)
                    .join(" · ")}
                  {photos.length > 1 && ` · ${index + 1} of ${photos.length}`}
                </p>
                {current.hidden && (
                  <p className="photo-warning">This photo is hidden and won&rsquo;t go in the book.</p>
                )}
                {current.warning && <p className="photo-warning">{current.warning}</p>}
                {downloadError && (
                  <p className="form-error" role="alert">
                    {downloadError}
                  </p>
                )}
              </div>
              <div className="actions">
                <button type="button" className="button" onClick={() => download(current.id)} disabled={downloading}>
                  {downloading ? "Preparing download…" : "Download original"}
                </button>
                {onToggleHidden && (
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={busy}
                    onClick={() => onToggleHidden(current.id, !current.hidden)}
                  >
                    {current.hidden ? "Show in book" : "Hide from book"}
                  </button>
                )}
                {photos.length > 1 && (
                  <>
                    <button type="button" className="button button-secondary" onClick={() => step(-1)}>
                      ← Previous
                    </button>
                    <button type="button" className="button button-secondary" onClick={() => step(1)}>
                      Next →
                    </button>
                  </>
                )}
                <button type="button" className="button button-secondary" onClick={close} autoFocus>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
