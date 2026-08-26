import Link from "next/link";

/**
 * Shared frame for the two sign-in entries.
 *
 * Student Login and Admin Login are separate routes with distinct framing,
 * because a student and a member of staff arrive with different expectations.
 * They are NOT separate authentication systems: both sign in through Supabase
 * Auth, and what each may then do is decided by their row in `user_roles` and
 * enforced by Row Level Security in the database.
 *
 * That distinction matters for security. Reaching the Admin Login page confers
 * nothing — signing in there as a student produces a student's session and a
 * student's permissions, exactly as if they had used the other page.
 *
 * The form itself is wired up in the authentication phase; the fields below are
 * inert and disabled, and say so.
 */
export function LoginPanel({
  heading,
  description,
  audience,
  footer,
}: {
  heading: string;
  description: string;
  audience: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-6 shadow-sm sm:p-8">
      <p className="font-ui text-xs font-semibold tracking-[0.16em] text-lgs-600 uppercase">
        {audience}
      </p>
      <h1 className="mt-2 font-heading text-2xl font-extrabold text-ink-strong">
        {heading}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-body">{description}</p>

      <form className="mt-7 space-y-4" aria-describedby="auth-pending">
        <div>
          <label
            htmlFor="email"
            className="block font-ui text-sm font-medium text-ink-strong"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            disabled
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface-sunken px-3 py-2.5 text-sm text-ink-body disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block font-ui text-sm font-medium text-ink-strong"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            disabled
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface-sunken px-3 py-2.5 text-sm text-ink-body disabled:cursor-not-allowed"
          />
        </div>

        <button
          type="submit"
          disabled
          className="w-full rounded bg-cell-ink px-4 py-2.5 font-ui text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sign in
        </button>
      </form>

      <p
        id="auth-pending"
        className="mt-4 rounded border border-border-subtle bg-surface-muted px-3 py-2.5 font-ui text-xs text-ink-muted"
      >
        Sign-in is not yet active. Authentication is connected in the next
        phase.
      </p>

      {footer && <div className="mt-6 border-t border-border-subtle pt-5">{footer}</div>}

      <p className="mt-6 text-center font-ui text-xs text-ink-muted">
        {heading === "Student Login" ? (
          <>
            Staff member?{" "}
            <Link href="/login/admin" className="text-lgs-600 underline">
              Admin Login
            </Link>
          </>
        ) : (
          <>
            Student?{" "}
            <Link href="/login/student" className="text-lgs-600 underline">
              Student Login
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
