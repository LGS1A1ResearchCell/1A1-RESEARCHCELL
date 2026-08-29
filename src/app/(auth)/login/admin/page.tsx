import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/SignInForm";
import { getSessionContext, homePathFor } from "@/lib/auth/session";

export const metadata = { title: "Admin Login" };

export default async function AdminLoginPage() {
  const ctx = await getSessionContext();
  if (ctx) redirect(homePathFor(ctx));

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-6 shadow-sm sm:p-8">
      <p className="font-ui text-xs font-semibold tracking-[0.16em] text-lgs-600 uppercase">
        Leadership and administration
      </p>
      <h1 className="mt-2 font-heading text-2xl font-extrabold text-ink-strong">
        Admin Login
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-body">
        Sign in to review submissions, manage journals and administer the
        Research Cell.
      </p>

      <SignInForm />

      {/* This page is a convenience, not a privilege. Signing in here grants
          exactly the permissions the account already holds — a student who
          uses this form gets a student's session and a student's access. */}
      <div className="mt-6 border-t border-border-subtle pt-5">
        <p className="text-sm leading-relaxed text-ink-body">
          Administrative accounts are created by the school. There is no
          self-registration for leadership or administration.
        </p>
      </div>

      <p className="mt-6 text-center font-ui text-xs text-ink-muted">
        Student?{" "}
        <Link href="/login/student" className="text-lgs-600 underline">
          Student Login
        </Link>
      </p>
    </div>
  );
}
