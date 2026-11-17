// The "Log in" page: chaptersofalife...com/login
import type { Metadata } from "next";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Chapters of a Life account.",
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Log in"
      intro={<p>Welcome back. Log in to see and continue your books.</p>}
      footer={
        <p>
          New to Chapters of a Life? <Link href="/signup">Create an account</Link>
        </p>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
