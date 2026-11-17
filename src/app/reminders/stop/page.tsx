// "Stop reminders": chaptersofalife.co.uk/reminders/stop?t=<private code>
// Linked from invitation and reminder emails. Asks the person to press a
// button (some email systems open links automatically, which shouldn't stop
// reminders by accident).
import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCard from "@/components/auth/AuthCard";
import StopRemindersButton from "@/components/StopRemindersButton";
import { isInviteToken } from "@/lib/invites";
import { getAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Stop reminders",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function StopRemindersPage({ searchParams }: PageProps<"/reminders/stop">) {
  return (
    <Suspense fallback={<AuthCard title="Stop reminders">{null}</AuthCard>}>
      {searchParams.then((q) => (
        <StopReminders token={String(q.t ?? "")} />
      ))}
    </Suspense>
  );
}

async function StopReminders({ token }: { token: string }) {
  const admin = getAdminClient();
  const found =
    isInviteToken(token) && admin
      ? (
          await admin
            .from("invitations")
            .select("reminders_stopped_at, books(full_name, known_as)")
            .eq("token", token)
            .maybeSingle<{ reminders_stopped_at: string | null; books: { full_name: string; known_as: string | null } | null }>()
        ).data
      : null;

  if (!found) {
    return (
      <AuthCard
        title="This link isn't working"
        intro={<p>The link may be incomplete. Please try copying it from the email again.</p>}
      >
        {null}
      </AuthCard>
    );
  }

  const name = found.books ? found.books.known_as || found.books.full_name.split(/\s+/)[0] : "this book";

  if (found.reminders_stopped_at) {
    return (
      <AuthCard
        title="Reminders stopped"
        intro={
          <p>
            You won&rsquo;t receive any more reminders about the book for {name}. If you&rsquo;d still
            like to add a memory, the link in your invitation will keep working until the book closes.
          </p>
        }
      >
        {null}
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Stop reminders?"
      intro={
        <p>
          We&rsquo;ll stop sending you reminder emails about the book of memories for {name}. You
          can still add a memory using the link in your invitation.
        </p>
      }
    >
      <StopRemindersButton token={token} name={name} />
    </AuthCard>
  );
}
