// Shown when an email link has expired or was already used.
import type { Metadata } from "next";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";

export const metadata: Metadata = {
  title: "This link has expired",
  robots: { index: false },
};

export default function LinkExpiredPage() {
  return (
    <AuthCard
      title="This link has expired"
      intro={
        <>
          <p>
            Email links only work once, and only for a short time. Please try
            logging in, or ask for a new link.
          </p>
          <p>
            If you asked for a new password, please open the email on the same
            phone or computer you used to ask for it.
          </p>
        </>
      }
    >
      <div className="actions">
        <Link href="/login" className="button">
          Log in
        </Link>
        <Link href="/forgot-password" className="button button-secondary">
          Reset my password
        </Link>
      </div>
    </AuthCard>
  );
}
