import { SetPasswordForm } from "@/components/auth/SetPasswordForm";

export const metadata = { title: "Choose your password" };

/**
 * Landing page for the invite link sent on approval.
 *
 * Supabase puts the recovery token in the URL fragment, which never reaches the
 * server, so the exchange has to happen in the browser. The form component
 * handles it and then sets the password.
 */
export default function SetPasswordPage() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-6 shadow-sm sm:p-8">
      <p className="font-ui text-xs font-semibold tracking-[0.16em] text-lgs-600 uppercase">
        Welcome to the Research Cell
      </p>
      <h1 className="mt-2 font-heading text-2xl font-extrabold text-ink-strong">
        Choose your password
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-body">
        Your account has been approved. Set a password to finish setting it up.
      </p>
      <SetPasswordForm />
    </div>
  );
}
