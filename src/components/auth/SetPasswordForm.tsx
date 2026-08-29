"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Completes an invite.
 *
 * Supabase returns the invite token in the URL *fragment* (`#access_token=…`),
 * which browsers never send to the server. The exchange therefore has to happen
 * here, in the browser, rather than in a server action.
 *
 * Once the session is established, updateUser sets the password the student
 * chooses. At no point does a password travel through our own tables or through
 * the approving administrator.
 */
export function SetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // The client library consumes the fragment on load; a session appearing is
    // what tells us the invite link was valid.
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      setReady(data.session ? "ok" : "invalid");
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady("ok");
    });

    void check();
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError("Please choose a password of at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  if (ready === "checking") {
    return <p className="mt-6 font-ui text-sm text-ink-muted">Checking your invitation…</p>;
  }

  if (ready === "invalid") {
    return (
      <div className="mt-6 rounded border border-cell-coral/40 bg-cell-coral/5 p-4">
        <h2 className="font-ui text-sm font-semibold text-ink-strong">
          This invitation link is not valid
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-body">
          It may have already been used or expired. Ask school administration to
          send you a new one.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-7 space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded border border-cell-coral/40 bg-cell-coral/5 px-3 py-2.5 font-ui text-sm text-ink-strong"
        >
          {error}
        </p>
      )}

      <div>
        <label htmlFor="password" className="block font-ui text-sm font-medium text-ink-strong">
          New password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="password-hint"
          className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
        />
        <p id="password-hint" className="mt-1 font-ui text-xs text-ink-muted">
          At least 10 characters.
        </p>
      </div>

      <div>
        <label htmlFor="confirm" className="block font-ui text-sm font-medium text-ink-strong">
          Confirm password
        </label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded bg-cell-ink px-4 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : "Set password and continue"}
      </button>
    </form>
  );
}
