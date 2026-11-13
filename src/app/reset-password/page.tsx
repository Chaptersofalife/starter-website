// The "Choose a new password" page: chaptersofalife...com/reset-password
// People arrive here from the link in a password-reset email.
import type { Metadata } from "next";
import AuthCard from "@/components/auth/AuthCard";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Choose a new password"
      intro={<p>Choose a new password for your account. You&rsquo;ll stay logged in.</p>}
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
