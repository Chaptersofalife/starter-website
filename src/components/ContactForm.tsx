"use client";

// The contact form. Messages are collected by Netlify Forms.
//
// How it works: Netlify learns about this form from the hidden copy in
// public/__forms.html, and this form sends each message there. If you change
// the fields below, change them in public/__forms.html too.
//
// Note: sending only works on the published site (or a Netlify preview),
// not in the `npm run dev` preview on your computer.

import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [senderName, setSenderName] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus("sending");
    try {
      const response = await fetch("/__forms.html", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(data as unknown as Record<string, string>).toString(),
      });
      if (!response.ok) {
        throw new Error(`Netlify Forms replied ${response.status}`);
      }
      setSenderName(String(data.get("name") ?? "").trim());
      setStatus("sent");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="form-success" role="status">
        <h2>Thank you{senderName ? `, ${senderName}` : ""}</h2>
        <p>Your message has been sent. We will reply to you by email.</p>
        <button type="button" className="button button-secondary" onClick={() => setStatus("idle")}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form name="contact" className="form" onSubmit={handleSubmit}>
      <input type="hidden" name="form-name" value="contact" />

      {/* Hidden from people; catches automated spam */}
      <p className="visually-hidden" aria-hidden="true">
        <label>
          Leave this empty
          <input name="bot-field" tabIndex={-1} autoComplete="off" />
        </label>
      </p>

      <div className="field">
        <label htmlFor="contact-name">Your name</label>
        <input id="contact-name" name="name" type="text" autoComplete="name" required />
      </div>

      <div className="field">
        <label htmlFor="contact-email">Your email</label>
        <input id="contact-email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="field">
        <label htmlFor="contact-message">Your message</label>
        <textarea id="contact-message" name="message" rows={6} required />
      </div>

      {status === "error" && (
        <p className="form-error" role="alert">
          Sorry, your message could not be sent. Please check your internet
          connection and try again.
        </p>
      )}

      <div>
        <button type="submit" className="button" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
