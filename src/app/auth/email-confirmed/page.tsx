// Shown when someone confirms their email on a different device from the one
// they signed up on. Their email is confirmed, they just need to log in here.
import type { Metadata } from "next";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";

export const metadata: Metadata = {
  title: "Your email is confirmed",
  robots: { index: false },
};

export default function EmailConfirmedPage() {
  return (
    <AuthCard
      title="Your email is confirmed"
      intro={
        <p>
          Thank you. Your account is ready. Please log in with your email and
          password to continue.
        </p>
      }
    >
      <div className="actions">
        <Link href="/login" className="button">
          Log in
        </Link>
      </div>
    </AuthCard>
  );
}
