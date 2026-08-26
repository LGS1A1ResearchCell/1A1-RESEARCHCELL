import Link from "next/link";

import { LoginPanel } from "@/components/site/LoginPanel";

export const metadata = { title: "Student Login" };

export default function StudentLoginPage() {
  return (
    <LoginPanel
      audience="Research Cell members"
      heading="Student Login"
      description="Sign in to submit research, confirm authorship, follow your submissions through review and read reviewer feedback."
      footer={
        <div>
          <h2 className="font-ui text-sm font-semibold text-ink-strong">
            New to the Research Cell?
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-body">
            Registering creates an account request. Accounts become active only
            once the Research Cell and school administration have reviewed the
            registration.
          </p>
          <Link
            href="/login/student/sign-up"
            className="mt-3 inline-block font-ui text-sm font-semibold text-lgs-600 underline"
          >
            Create an account
          </Link>
        </div>
      }
    />
  );
}
