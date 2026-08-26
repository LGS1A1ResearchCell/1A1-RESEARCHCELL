import Link from "next/link";

export const metadata = { title: "Create an account" };

/**
 * Registration placeholder.
 *
 * The real form is built in the authentication phase. It collects full name,
 * email, class (A1 or A2) and year joined -- the last entered manually, since a
 * student who joined in 2025 cannot be inferred from the current year.
 *
 * Submitting will create an account_request in the pending state. The account
 * does not become usable until school administration approves it, and that
 * approval is recorded in the database rather than depending on email.
 */
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
        Registration is connected in the authentication phase. When it is, you
        will be asked for your full name, email address, class and the year you
        joined the Research Cell.
      </p>

      <div className="mt-5 rounded border border-border-subtle bg-surface-muted p-4">
        <h2 className="font-ui text-sm font-semibold text-ink-strong">
          What happens after you register
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-body">
          Your account will be submitted for approval and will become available
          once the Research Cell and school administration have reviewed your
          registration.
        </p>
      </div>

      <Link
        href="/login/student"
        className="mt-6 inline-block font-ui text-sm font-semibold text-lgs-600 underline"
      >
        Back to Student Login
      </Link>
    </div>
  );
}
