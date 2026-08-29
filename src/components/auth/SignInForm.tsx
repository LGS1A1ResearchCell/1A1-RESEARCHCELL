"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn, type FormState } from "@/lib/auth/actions";

const initial: FormState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-cell-ink px-4 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function SignInForm() {
  const [state, action] = useActionState(signIn, initial);

  return (
    <form action={action} className="mt-7 space-y-4">
      {state.message && (
        <p
          role="alert"
          className="rounded border border-cell-coral/40 bg-cell-coral/5 px-3 py-2.5 font-ui text-sm leading-relaxed text-ink-strong"
        >
          {state.message}
        </p>
      )}

      <div>
        <label htmlFor="email" className="block font-ui text-sm font-medium text-ink-strong">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
        />
      </div>

      <div>
        <label htmlFor="password" className="block font-ui text-sm font-medium text-ink-strong">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
