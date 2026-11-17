// Sends emails through Resend (server only).
// Uses RESEND_API_KEY from .env.local / Netlify's environment variables.
import "server-only";

/** Who emails come from. Your domain must be verified in Resend. */
export const EMAIL_FROM = "Chapters of a Life <hello@chaptersofalife.co.uk>";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Replies go here (e.g. the organiser), instead of hello@. */
  replyTo?: string;
  headers?: Record<string, string>;
};

export type SendResult = { sent: number; failed: number; error?: string };

/** True if emails can be sent (the Resend key has been added). */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Sends emails in batches of up to 100 (Resend's batch limit), which keeps
 * well within Resend's rate limits.
 */
export async function sendEmails(messages: EmailMessage[]): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("RESEND_API_KEY is missing, so no emails were sent.");
    return { sent: 0, failed: messages.length, error: "Email isn't set up (RESEND_API_KEY is missing)." };
  }

  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          batch.map((m) => ({
            from: EMAIL_FROM,
            to: [m.to],
            subject: m.subject,
            html: m.html,
            text: m.text,
            ...(m.replyTo ? { reply_to: m.replyTo } : {}),
            ...(m.headers ? { headers: m.headers } : {}),
          })),
        ),
      });
      if (!response.ok) {
        const body = await response.text();
        console.error("Resend batch failed:", response.status, body.slice(0, 300));
        lastError = `The email service replied ${response.status}.`;
        failed += batch.length;
      } else {
        sent += batch.length;
      }
    } catch (e) {
      console.error("Resend batch failed:", e);
      lastError = "The email service couldn't be reached.";
      failed += batch.length;
    }
  }
  return { sent, failed, error: lastError };
}
