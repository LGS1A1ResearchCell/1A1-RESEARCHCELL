import Link from "next/link";

import { SignUpForm } from "@/components/auth/SignUpForm";
import { joinYearOptions } from "@/lib/auth/years";

export const metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-6 shadow-sm sm:p-8">
      <p className="font-ui text-xs font-semibold tracking-[0.16em] text-lgs-600 uppercase">
        Research Cell members
      </p>
      <h1 className="mt-2 font-heading text-2xl font-extrabold text-ink-strong">
        Create an account
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-body">
        Registering submits your details for review. You will choose a password
        once your account has been approved.
      </p>

      <SignUpForm years={joinYearOptions()} />

      <p className="mt-6 text-center font-ui text-xs text-ink-muted">
        Already have an account?{" "}
        <Link href="/login/student" className="text-lgs-600 underline">
          Student Login
        </Link>
      </p>
    </div>
  );
}
