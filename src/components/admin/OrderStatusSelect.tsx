"use client";

// Lets the admin move an order through: Paid – being designed → Preview sent
// → Changes requested → Approved → Sent to printer → Dispatched → Delivered.
// Choosing "Dispatched" asks for tracking details, which are emailed to the
// organiser.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminStatusChoices, orderStatusLabels, type OrderStatus } from "@/lib/orders";

type Props = {
  orderId: string;
  status: OrderStatus;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  setStatus: (
    orderId: string,
    status: string,
    tracking?: { number?: string; url?: string },
  ) => Promise<{ ok: boolean; error?: string }>;
};

export default function OrderStatusSelect({ orderId, status, trackingNumber, trackingUrl, setStatus }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<string>(status);
  const [number, setNumber] = useState(trackingNumber ?? "");
  const [url, setUrl] = useState(trackingUrl ?? "");
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const editable = adminStatusChoices.includes(status);

  if (!editable) {
    return <span className="closed-label">{orderStatusLabels[status]}</span>;
  }

  const dispatching = value === "dispatched" && status !== "dispatched";

  return (
    <form
      className="order-status-form"
      onSubmit={(e) => {
        e.preventDefault();
        setNote(null);
        startTransition(async () => {
          const res = await setStatus(orderId, value, dispatching ? { number, url } : undefined).catch(() => ({
            ok: false,
            error: "Something went wrong.",
          }));
          setNote(
            res.ok
              ? { text: res.error ?? (dispatching ? "Saved, and the organiser has been emailed." : "Saved") }
              : { text: res.error ?? "Didn't save", error: true },
          );
          if (res.ok) router.refresh();
        });
      }}
    >
      <label htmlFor={`status-${orderId}`} className="visually-hidden">
        Order status
      </label>
      <select id={`status-${orderId}`} value={value} onChange={(e) => setValue(e.target.value)}>
        {adminStatusChoices.map((s) => (
          <option key={s} value={s}>
            {orderStatusLabels[s]}
          </option>
        ))}
      </select>

      {dispatching && (
        <div className="tracking-fields">
          <label>
            Tracking number
            <input type="text" value={number} maxLength={100} onChange={(e) => setNumber(e.target.value)} />
          </label>
          <label>
            Tracking link
            <input
              type="url"
              value={url}
              maxLength={500}
              placeholder="https://"
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <span className="invited-meta">Add at least one. The organiser will be emailed.</span>
        </div>
      )}

      <button type="submit" className="button button-secondary" disabled={pending || value === status}>
        {pending ? "Saving…" : dispatching ? "Save and email" : "Save"}
      </button>
      {note && (
        <span className={note.error ? "field-error" : "invited-meta"} role="status">
          {note.text}
        </span>
      )}
    </form>
  );
}
