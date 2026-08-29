import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/SignInForm";
import { getSessionContext, homePathFor } from "@/lib/auth/session";

export const metadata = { title: "Student Login" };

export default async function StudentLoginPage() {
  // Already signed in: send them where they belong rather than showing a form
  // that would only sign them in again.
  const ctx = await getSessionContext();
  if (ctx) redirect(homePathFor(ctx));

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-6 shadow-sm sm:p-8">
      <p className="font-ui text-xs font-semibold tracking-[0.16em] text-lgs-600 uppercase">
        Research Cell members
      </p>
      <h1 className="mt-2 font-heading text-2xl font-extrabold text-ink-strong">
        Student Login
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-body">
        Sign in to submit research, confirm authorship, follow your submissions
        through review and read reviewer feedback.
      </p>

      <SignInForm />

      <div className="mt-6 border-t border-border-subtle pt-5">
        <h2 className="font-ui text-sm font-semibold text-ink-strong">
          New to the Research Cell?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-body">
          Registering creates an account request. Your account becomes available
          once the Research Cell and school administration have reviewed it.
        </p>
        <Link
          href="/login/student/sign-up"
          className="mt-3 inline-block font-ui text-sm font-semibold text-lgs-600 underline"
        >
          Create an account
        </Link>
      </div>

      <p className="mt-6 text-center font-ui text-xs text-ink-muted">
        Staff member?{" "}
        <Link href="/login/admin" className="text-lgs-600 underline">
          Admin Login
        </Link>
      </p>
    </div>
  );
}
