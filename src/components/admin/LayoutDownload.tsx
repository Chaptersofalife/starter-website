"use client";

// "Download for layout": builds a zip in the admin's browser containing
//   - "<name> - memories.docx": the book details and every APPROVED memory
//     in the order received, with each photo's code, caption and file name
//   - "photo-list.csv": every photo, for matching files to memories
//   - "cover.<ext>" and "photos/M03-P02 Susan Ellis.heic" etc.: the
//     full-quality originals, untouched
// (It's built here rather than on the server because a book's photos are
// too large to send through our server in one go.)

import { useState } from "react";
import type { LayoutPackage } from "@/app/admin/actions";

type LayoutDownloadProps = {
  getPackage: () => Promise<LayoutPackage | { error: string }>;
};

export default function LayoutDownload({ getPackage }: LayoutDownloadProps) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    setError("");
    setStatus("Gathering the approved memories…");
    try {
      const pkg = await getPackage();
      if ("error" in pkg) throw new Error(pkg.error);

      const [{ Zip, ZipPassThrough, ZipDeflate, strToU8 }, docxBlob] = await Promise.all([
        import("fflate"),
        buildDocument(pkg),
      ]);

      const chunks: Uint8Array[] = [];
      let zipError: Error | null = null;
      let finished!: () => void;
      const done = new Promise<void>((resolve) => (finished = resolve));
      const zip = new Zip((err, chunk, final) => {
        if (err) zipError = err;
        else chunks.push(chunk);
        if (final || err) finished();
      });

      const addText = (name: string, text: string) => {
        const file = new ZipDeflate(name, { level: 6 });
        zip.add(file);
        file.push(strToU8(text), true);
      };
      const addBytes = (name: string, bytes: Uint8Array) => {
        const file = new ZipPassThrough(name); // photos are already compressed
        zip.add(file);
        file.push(bytes, true);
      };

      addBytes(`${pkg.book.fullName.replace(/[\\/:*?"<>|]/g, "")} - memories.docx`, new Uint8Array(await docxBlob.arrayBuffer()));
      addText("photo-list.csv", photoListCsv(pkg));

      // Download each original and add it, one at a time.
      const files = [
        ...(pkg.cover ? [{ zipPath: pkg.cover.zipPath, url: pkg.cover.url, label: "cover photo" }] : []),
        ...pkg.memories.flatMap((m) => m.photos.map((p) => ({ zipPath: p.zipPath, url: p.url, label: p.code }))),
      ];
      const missing: string[] = [];
      for (const [i, file] of files.entries()) {
        setStatus(`Adding photos: ${i + 1} of ${files.length}…`);
        try {
          const res = await fetch(file.url);
          if (!res.ok) throw new Error(String(res.status));
          addBytes(file.zipPath, new Uint8Array(await res.arrayBuffer()));
        } catch {
          missing.push(`${file.label} (${file.zipPath})`);
        }
      }
      if (missing.length > 0) {
        addText(
          "MISSING PHOTOS.txt",
          `These photos couldn't be downloaded. Please try the download again, or download them one by one from the admin page:\r\n\r\n${missing.join("\r\n")}\r\n`,
        );
      }

      zip.end();
      await done;
      if (zipError) throw zipError;

      setStatus("Saving the zip file…");
      const blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pkg.fileBase}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      setStatus(
        `Done: ${pkg.memories.length} approved ${pkg.memories.length === 1 ? "memory" : "memories"} and ${files.length} ${files.length === 1 ? "photo" : "photos"}` +
          (missing.length > 0 ? `. ${missing.length} couldn't be downloaded (see "MISSING PHOTOS.txt" in the zip).` : "."),
      );
    } catch (e) {
      setStatus("");
      setError(e instanceof Error && e.message ? e.message : "The download didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="layout-download">
      <button type="button" className="button" onClick={download} disabled={busy}>
        {busy ? "Preparing…" : "Download for layout"}
      </button>
      <p className="field-hint">
        A zip with a Word document of the approved memories, and every approved photo at full
        quality. Large books can take a few minutes. Please keep this page open.
      </p>
      {status && (
        <p className="admin-status" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function photoListCsv(pkg: LayoutPackage) {
  const rows = [["Photo code", "Memory", "Contributor", "Caption", "Roughly when", "Width", "Height", "Note", "File"]];
  if (pkg.cover) rows.push(["COVER", "", "", "Cover photo", "", "", "", "", pkg.cover.zipPath]);
  for (const m of pkg.memories) {
    for (const p of m.photos) {
      rows.push([
        p.code,
        m.number,
        m.contributorName,
        p.caption ?? "",
        p.taken ?? "",
        String(p.width ?? ""),
        String(p.height ?? ""),
        p.warning ? "Small: may print soft" : "",
        p.zipPath,
      ]);
    }
  }
  // The "﻿" helps Excel open the file with the right characters.
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** The Word document: book details, then each approved memory in order. */
async function buildDocument(pkg: LayoutPackage): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");

  const para = (text: string, opts: { italics?: boolean; bold?: boolean; size?: number } = {}) =>
    new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text, ...opts })] });
  // Keeps the line breaks people typed.
  const paragraphs = (text: string, opts: { italics?: boolean } = {}) =>
    text
      .split(/\r?\n\s*\r?\n/)
      .map((block) =>
        new Paragraph({
          spacing: { after: 160 },
          children: block
            .split(/\r?\n/)
            .map((line, i) => new TextRun({ text: line, ...(i > 0 ? { break: 1 } : {}), ...opts })),
        }),
      );
  const label = (name: string, value: string) =>
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: `${name}: `, bold: true }), new TextRun({ text: value })],
    });

  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(pkg.book.fullName)] }),
  ];
  if (pkg.book.knownAs) children.push(label("Known as", pkg.book.knownAs));
  if (pkg.book.dates) children.push(label("Dates", pkg.book.dates));
  if (pkg.book.livedIn) children.push(label("Lived in", pkg.book.livedIn));
  children.push(label("Cover photo", pkg.cover ? pkg.cover.zipPath : "None"));
  children.push(
    label(
      "Contents",
      `${pkg.memories.length} approved ${pkg.memories.length === 1 ? "memory" : "memories"}, in the order they were received`,
    ),
  );
  children.push(label("Prepared", pkg.preparedAt));

  if (pkg.book.introduction) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Introduction")] }));
    children.push(...paragraphs(pkg.book.introduction));
  }

  for (const m of pkg.memories) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun(`Memory ${m.number}: ${m.contributorName}`)],
      }),
    );
    children.push(label("Relationship", m.relationship));
    if (m.edited) children.push(para("(Text corrected by the organiser.)", { italics: true, size: 18 }));
    children.push(...paragraphs(m.text));

    if (m.sayings) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Favourite sayings")] }));
      children.push(...paragraphs(m.sayings, { italics: true }));
    }

    if (m.photos.length > 0) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Photos")] }));
      for (const p of m.photos) {
        const details = [p.caption, p.taken ? `(${p.taken})` : null].filter(Boolean).join(" ");
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 80 },
            children: [
              new TextRun({ text: `${p.code}`, bold: true }),
              new TextRun({ text: details ? `: ${details}` : ": (no caption)" }),
              new TextRun({ text: `  File: ${p.zipPath}`, size: 18 }),
              ...(p.warning
                ? [new TextRun({ text: `  Note: small photo (${p.width} × ${p.height} pixels), may print soft.`, size: 18, italics: true })]
                : []),
            ],
          }),
        );
      }
    }
  }

  if (pkg.memories.length === 0) {
    children.push(para("No memories have been approved yet."));
  }

  const doc = new Document({
    creator: "Chapters of a Life",
    title: `${pkg.book.fullName}: memories for layout`,
    sections: [{ children }],
  });
  return Packer.toBlob(doc);
}
