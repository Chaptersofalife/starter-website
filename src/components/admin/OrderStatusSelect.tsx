"use client";

// Lets the admin move an order through: Paid – being designed → Preview sent
// → Approved → Sent to printer → Dispatched → Delivered.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminStatusChoices, orderStatusLabels, type OrderStatus } from "@/lib/orders";

type Props = {
  orderId: string;
  status: OrderStatus;
  setStatus: (orderId: string, status: string) => Promise<{ ok: boolean; error?: string }>;
};

export default function OrderStatusSelect({ orderId, status, setStatus }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<string>(status);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const editable = adminStatusChoices.includes(status);

  if (!editable) {
    return <span className="closed-label">{orderStatusLabels[status]}</span>;
  }

  return (
    <form
      className="order-status-form"
      onSubmit={(e) => {
        e.preventDefault();
        setNote(null);
        startTransition(async () => {
          const res = await setStatus(orderId, value).catch(() => ({ ok: false, error: "Something went wrong." }));
          setNote(res.ok ? { text: "Saved" } : { text: res.error ?? "Didn't save", error: true });
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
      <button type="submit" className="button button-secondary" disabled={pending || value === status}>
        {pending ? "Saving…" : "Save"}
      </button>
      {note && (
        <span className={note.error ? "field-error" : "invited-meta"} role="status">
          {note.text}
        </span>
      )}
    </form>
  );
}
