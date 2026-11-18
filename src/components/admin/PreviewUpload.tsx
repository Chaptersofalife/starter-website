"use client";

// Admin: upload a preview PDF for an order. It goes straight to the private
// "book-previews" store, then the order becomes "Preview sent" and the
// organiser is emailed.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_PREVIEW_BYTES, PREVIEW_BUCKET } from "@/lib/orders";

type Props = {
  orderId: string;
  nextVersion: number;
  prepare: (info: { size: number; type: string }) => Promise<
    { ok: true; path: string; token: string; version: number } | { ok: false; error: string }
  >;
  publish: (upload: { path: string; version: number; fileName: string; size: number }) => Promise<{
    ok: boolean;
    error?: string;
    message?: string;
  }>;
};

export default function PreviewUpload({ orderId, nextVersion, prepare, publish }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setNote(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setNote({ text: "Please choose a PDF file.", error: true });
      return;
    }
    if (file.size > MAX_PREVIEW_BYTES) {
      setNote({ text: "The PDF is too large. Previews can be up to 50 MB.", error: true });
      return;
    }
    setBusy(true);
    try {
      const pass = await prepare({ size: file.size, type: "application/pdf" });
      if (!pass.ok) throw new Error(pass.error);
      setNote({ text: `Uploading version ${pass.version}…` });
      const { createClient } = await import("@/lib/supabase/client");
      const { error } = await createClient()
        .storage.from(PREVIEW_BUCKET)
        .uploadToSignedUrl(pass.path, pass.token, file, { contentType: "application/pdf", upsert: false });
      if (error) throw new Error("The upload didn't finish. Please check your connection and try again.");
      const result = await publish({ path: pass.path, version: pass.version, fileName: file.name, size: file.size });
      if (!result.ok) throw new Error(result.error);
      setNote({ text: result.message ?? "Preview sent." });
      router.refresh();
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : "Something went wrong.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="preview-upload">
      <input
        id={`preview-${orderId}`}
        type="file"
        accept="application/pdf,.pdf"
        className="visually-hidden"
        disabled={busy}
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <label htmlFor={`preview-${orderId}`} className="button button-secondary" aria-disabled={busy || undefined}>
        {busy ? "Uploading…" : nextVersion === 1 ? "Upload preview PDF" : `Upload version ${nextVersion}`}
      </label>
      {note && (
        <p className={note.error ? "form-error" : "admin-status"} role="status">
          {note.text}
        </p>
      )}
    </div>
  );
}
