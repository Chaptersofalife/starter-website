"use client";

import { useState, useTransition } from "react";
import { stopReminders } from "@/app/reminders/actions";

export default function StopRemindersButton({ token, name }: { token: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"" | "ok" | "error">("");

  if (done === "ok") {
    return (
      <p className="form-success" role="status">
        Done. You won&rsquo;t receive any more reminders about the book for {name}.
      </p>
    );
  }

  return (
    <div className="form">
      {done === "error" && (
        <p className="form-error" role="alert">
          Sorry, that didn&rsquo;t work. Please try again.
        </p>
      )}
      <div>
        <button
          type="button"
          className="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await stopReminders(token).catch(() => ({ ok: false }));
              setDone(result.ok ? "ok" : "error");
            })
          }
        >
          {pending ? "Stopping…" : "Stop reminders"}
        </button>
      </div>
    </div>
  );
}
