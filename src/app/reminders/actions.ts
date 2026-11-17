"use server";

// Stops reminder emails for one invited person and one book.
// Uses their private code from the email link (no account needed).

import { isInviteToken } from "@/lib/invites";
import { getAdminClient } from "@/lib/supabase/admin";

export async function stopReminders(token: string): Promise<{ ok: boolean }> {
  if (!isInviteToken(token)) return { ok: false };
  const admin = getAdminClient();
  if (!admin) return { ok: false };
  const { data, error } = await admin
    .from("invitations")
    .update({ reminders_stopped_at: new Date().toISOString() })
    .eq("token", token)
    .is("reminders_stopped_at", null)
    .select("id");
  if (error) {
    console.error("Stop reminders failed:", error.message);
    return { ok: false };
  }
  // Already stopped counts as success too.
  if (!data || data.length === 0) {
    const { data: existing } = await admin.from("invitations").select("id").eq("token", token).maybeSingle();
    return { ok: Boolean(existing) };
  }
  return { ok: true };
}
