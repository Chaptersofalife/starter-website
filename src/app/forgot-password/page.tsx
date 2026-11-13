// The "Forgot your password?" page: chaptersofalife...com/forgot-password
import type { Metadata } from "next";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot your password?",
  description: "Get a link to choose a new password for your Chapters of a Life account.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      intro={
        <p>
          It happens to everyone. Enter your email and we&rsquo;ll send you a
          link to choose a new one.
        </p>
      }
      footer={
        <p>
          Remembered it? <Link href="/login">Log in</Link>
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
