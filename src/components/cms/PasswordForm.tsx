"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signInToCms, type FormState } from "@/lib/auth/actions";

const initial: FormState = { ok: false };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 w-full rounded bg-cell-ink px-5 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Checking…" : "Open management area"}
    </button>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(signInToCms, initial);

  return (
    <form action={action}>
      <label
        htmlFor="cms-password"
        className="block font-ui text-sm font-medium text-ink-strong"
      >
        Management password
      </label>
      <input
        id="cms-password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        autoFocus
        aria-invalid={state.message ? true : undefined}
        aria-describedby={state.message ? "cms-password-error" : undefined}
        className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
      />

      {state.message && (
        <p
          id="cms-password-error"
          role="alert"
          className="mt-2 font-ui text-sm text-cell-coral-text"
        >
          {state.message}
        </p>
      )}

      <Submit />
    </form>
  );
}
