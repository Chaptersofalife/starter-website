// The "Create an account" page: chaptersofalife...com/signup
import type { Metadata } from "next";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a Chapters of a Life account to start a memorial book.",
};

export default function SignupPage() {
  return (
    <AuthCard
      title="Create an account"
      intro={
        <p>
          Your account lets you start a book, invite family and friends, and
          come back whenever you&rsquo;re ready. Family and friends who add
          memories don&rsquo;t need an account.
        </p>
      }
      footer={
        <>
          <p>
            Already have an account? <Link href="/login">Log in</Link>
          </p>
          <p className="auth-small">
            By creating an account you agree to our{" "}
            <Link href="/terms">Terms &amp; Conditions</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
