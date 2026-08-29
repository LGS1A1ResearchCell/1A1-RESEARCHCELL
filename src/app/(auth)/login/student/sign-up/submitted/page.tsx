import Link from "next/link";

export const metadata = { title: "Registration submitted" };

/**
 * Shown after any signup submission.
 *
 * Reached identically whether a new request was created, one already existed,
 * or the address already holds an account — so the form cannot be used to
 * discover who has registered.
 */
export default function SubmittedPage() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-6 shadow-sm sm:p-8">
      <h1 className="font-heading text-2xl font-extrabold text-ink-strong">
        Registration submitted
      </h1>

      <p className="mt-4 text-sm leading-relaxed text-ink-body">
        Your account has been submitted for approval. Your account will become
        available once the Research Cell and school administration have reviewed
        your registration. You will receive an email when your account has been
        approved.
      </p>

      <div className="mt-6 rounded border border-border-subtle bg-surface-muted p-4">
        <h2 className="font-ui text-sm font-semibold text-ink-strong">
          What happens next
        </h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-body">
          <li>School administration reviews your registration.</li>
          <li>Once approved, you are sent a link to choose your password.</li>
          <li>You can then sign in and submit research.</li>
        </ol>
      </div>

      <Link
        href="/"
        className="mt-6 inline-block font-ui text-sm font-semibold text-lgs-600 underline"
      >
        Return to the public site
      </Link>
    </div>
  );
}
