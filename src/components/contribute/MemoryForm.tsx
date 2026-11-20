"use client";

// The form contributors use to share a memory and photos. No account needed.

import { useEffect, useState } from "react";
import type { MemoryFields, MemoryResult } from "@/app/contribute/actions";
import FormError from "@/components/auth/FormError";
import { SUGGESTED_WORDS, memoryLimits, memoryPrompts } from "@/lib/invites";
import { uploadPhotoFiles } from "@/lib/photos-client";
import PhotoPicker, { type PickedPhoto } from "./PhotoPicker";

type MemoryFormProps = {
  /** Sends the memory (the invite link is already attached). */
  submit: (formData: FormData) => Promise<MemoryResult>;
  /** Confirms which photos arrived safely. */
  finishPhotos: (memoryId: string, photoIds: string[]) => Promise<{ received: number }>;
  /** Tidies up a photo that couldn't be uploaded. */
  abandonPhoto: (memoryId: string, photoId: string) => Promise<void>;
  /** The name to use in the wording, e.g. "Peggy". */
  personName: string;
  /** Their personal code, if they came from an email invitation. */
  invitationKey?: string;
};

type Phase = "editing" | "sending" | "uploading" | "done" | "closed";

export default function MemoryForm({ submit, finishPhotos, abandonPhoto, personName, invitationKey = "" }: MemoryFormProps) {
  const [phase, setPhase] = useState<Phase>("editing");
  const [result, setResult] = useState<MemoryResult>({});
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState({ firstName: "", sent: 0, failed: 0 });
  // Their details, kept for "Add another memory".
  const [kept, setKept] = useState<Partial<MemoryFields>>({});
  const [formKey, setFormKey] = useState(0);
  const [words, setWords] = useState(0);

  // Ask before leaving the page while photos are still uploading.
  useEffect(() => {
    if (phase !== "uploading" && phase !== "sending") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (photos.some((p) => p.status === "preparing")) {
      setResult({ error: "Please wait a moment while your photos finish preparing." });
      return;
    }
    if (photos.some((p) => p.status === "error")) {
      setResult({ error: "Please remove the photos that can't be used before sending." });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const ready = photos.filter((p) => p.status === "ready" && p.prepared);
    formData.set(
      "photos",
      JSON.stringify(
        ready.map((p) => ({
          name: p.prepared!.original.name,
          mime: p.prepared!.mime,
          size: p.prepared!.original.size,
          width: p.prepared!.width,
          height: p.prepared!.height,
          caption: p.caption,
          taken: p.taken,
        })),
      ),
    );

    setPhase("sending");
    setResult({});
    let res: MemoryResult;
    try {
      res = await submit(formData);
    } catch {
      res = { error: "Sorry, your memory couldn't be sent just now. Please check your connection and try again." };
    }
    if (!res.ok) {
      if (res.closed) {
        // The book closed while the form was open (checked by the database).
        clearPhotos();
        setPhase("closed");
        return;
      }
      setResult(res);
      setPhase("editing");
      return;
    }

    const name = String(formData.get("contributor_name") ?? "").trim();
    setKept({
      contributor_name: name,
      contributor_email: String(formData.get("contributor_email") ?? ""),
      relationship: String(formData.get("relationship") ?? ""),
    });

    // Upload each photo straight to the private photo store.
    const uploads = res.uploads ?? [];
    const succeeded: string[] = [];
    let failed = res.photosFailed ? ready.length : 0;
    if (uploads.length > 0 && res.memoryId) {
      setPhase("uploading");
      setProgress({ done: 0, total: uploads.length });
      for (const [i, upload] of uploads.entries()) {
        try {
          await uploadPhotoFiles(ready[i].prepared!, upload.targets);
          succeeded.push(upload.photoId);
        } catch {
          failed++;
          await abandonPhoto(res.memoryId, upload.photoId).catch(() => {});
        }
        setProgress({ done: i + 1, total: uploads.length });
      }
      if (succeeded.length > 0) {
        await finishPhotos(res.memoryId, succeeded).catch(() => {});
      }
    }

    setSummary({ firstName: name.split(/\s+/)[0] ?? "", sent: succeeded.length, failed });
    clearPhotos();
    setPhase("done");
  }

  function clearPhotos() {
    setPhotos((current) => {
      current.forEach((p) => p.prepared && URL.revokeObjectURL(p.prepared.previewUrl));
      return [];
    });
  }

  if (phase === "closed") {
    return (
      <div className="thank-you" role="status">
        <h2>This book is now closed</h2>
        <p>This book is now closed to new memories. Thank you for being part of it.</p>
        <p>
          If you have something you&rsquo;d still like to share, please get in touch with the person
          who invited you.
        </p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="thank-you" role="status">
        <h2>Thank you{summary.firstName ? `, ${summary.firstName}` : ""}</h2>
        <p>
          Your memory of {personName}
          {summary.sent > 0 ? ` and ${summary.sent === 1 ? "your photo" : `your ${summary.sent} photos`}` : ""}{" "}
          {summary.sent > 0 ? "have" : "has"} been sent to the family. It will mean a great deal to them.
        </p>
        {summary.failed > 0 && (
          <p className="photo-warning">
            {summary.failed === 1 ? "One photo" : `${summary.failed} photos`} couldn&rsquo;t be
            uploaded, perhaps because of a weak connection. Your words arrived safely. You can
            add the {summary.failed === 1 ? "photo" : "photos"} again with another memory.
          </p>
        )}
        <p>If something else comes to mind, you&rsquo;re very welcome to add another.</p>
        <div className="actions">
          <button
            type="button"
            className="button"
            onClick={() => {
              setResult({});
              setWords(0);
              setFormKey((k) => k + 1);
              setPhase("editing");
            }}
          >
            Add another memory
          </button>
        </div>
      </div>
    );
  }

  const busy = phase === "sending" || phase === "uploading";
  const errors = result.fieldErrors ?? {};
  const errorProps = (name: keyof MemoryFields, hintId?: string) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby":
      [hintId, errors[name] ? `${name}-error` : null].filter(Boolean).join(" ") || undefined,
  });
  const fieldError = (name: keyof MemoryFields) =>
    errors[name] ? (
      <p id={`${name}-error`} className="field-error">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} className="form" key={formKey} noValidate>
      {/* When the form appeared, for spam protection (robots send instantly) */}
      <input
        type="hidden"
        name="started_at"
        ref={(el) => {
          if (el && !el.value) el.value = String(Date.now());
        }}
      />

      {/* Links this memory to their email invitation, so they aren't sent reminders */}
      <input type="hidden" name="invitation" value={invitationKey} />

      {/* Hidden from people; catches automated spam */}
      <p className="visually-hidden" aria-hidden="true">
        <label>
          Leave this empty
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </p>

      <div className="field">
        <label htmlFor="contributor_name">Your name</label>
        <input
          id="contributor_name"
          name="contributor_name"
          type="text"
          autoComplete="name"
          maxLength={memoryLimits.contributor_name}
          defaultValue={kept.contributor_name ?? ""}
          required
          {...errorProps("contributor_name")}
        />
        {fieldError("contributor_name")}
      </div>

      <div className="field">
        <label htmlFor="contributor_email">Your email</label>
        <input
          id="contributor_email"
          name="contributor_email"
          type="email"
          autoComplete="email"
          maxLength={memoryLimits.contributor_email}
          defaultValue={kept.contributor_email ?? ""}
          required
          {...errorProps("contributor_email", "contributor_email-hint")}
        />
        <p id="contributor_email-hint" className="field-hint">
          Only the person who invited you will see this, in case they&rsquo;d
          like to thank you or ask about your memory.
        </p>
        {fieldError("contributor_email")}
      </div>

      <div className="field">
        <label htmlFor="relationship">How you knew {personName}</label>
        <input
          id="relationship"
          name="relationship"
          type="text"
          maxLength={memoryLimits.relationship}
          defaultValue={kept.relationship ?? ""}
          required
          {...errorProps("relationship", "relationship-hint")}
        />
        <p id="relationship-hint" className="field-hint">
          For example, &ldquo;granddaughter&rdquo;, &ldquo;school friend&rdquo; or
          &ldquo;neighbour for 30 years&rdquo;.
        </p>
        {fieldError("relationship")}
      </div>

      <div className="field">
        <label htmlFor="memory">Your memory</label>
        <div id="memory-prompts" className="prompts">
          <p>If you&rsquo;re not sure where to begin, you might think about:</p>
          <ul>
            {memoryPrompts.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
          <p>
            Around {SUGGESTED_WORDS.min}&ndash;{SUGGESTED_WORDS.max} words is ideal: a few short paragraphs, so
            there&rsquo;s room in the book for everyone&rsquo;s memories.
          </p>
        </div>
        <textarea
          id="memory"
          name="memory"
          rows={12}
          maxLength={memoryLimits.memory}
          required
          onChange={(e) => setWords(e.target.value.trim() ? e.target.value.trim().split(/\s+/).length : 0)}
          {...errorProps("memory", "memory-prompts memory-count")}
        />
        <p id="memory-count" className="field-hint" aria-live="polite">
          {words} {words === 1 ? "word" : "words"}
          {words > SUGGESTED_WORDS.max + 50
            ? ". That's a lovely long memory. The family may shorten it a little to fit the book."
            : ` · around ${SUGGESTED_WORDS.min}–${SUGGESTED_WORDS.max} is ideal`}
        </p>
        {fieldError("memory")}
      </div>

      <div className="field">
        <label htmlFor="sayings">
          Favourite sayings or quotes of theirs <span className="optional">(optional)</span>
        </label>
        <textarea
          id="sayings"
          name="sayings"
          rows={3}
          maxLength={memoryLimits.sayings}
          {...errorProps("sayings", "sayings-hint")}
        />
        <p id="sayings-hint" className="field-hint">
          Something they often said, a family phrase, or words they lived by.
        </p>
        {fieldError("sayings")}
      </div>

      <PhotoPicker photos={photos} onChange={setPhotos} disabled={busy} personName={personName} />

      <FormError message={result.error} />

      {phase === "uploading" && (
        <p className="upload-progress" role="status">
          Your memory has been saved. Uploading photos: {progress.done} of {progress.total}.
          Please keep this page open.
        </p>
      )}

      <div>
        <button type="submit" className="button" disabled={busy}>
          {phase === "sending" ? "Sending…" : phase === "uploading" ? "Uploading photos…" : "Send my memory"}
        </button>
      </div>
    </form>
  );
}
