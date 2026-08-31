"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { submitAccountRequest, type FormState } from "@/lib/auth/actions";

const initial: FormState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-cell-ink px-4 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Submitting…" : "Submit registration"}
    </button>
  );
}

export function SignUpForm({ years }: { years: number[] }) {
  const [state, action] = useActionState(submitAccountRequest, initial);
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="mt-7 space-y-4" noValidate>
      {state.message && (
        <p
          role="alert"
          className="rounded border border-cell-coral/40 bg-cell-coral/5 px-3 py-2.5 font-ui text-sm text-ink-strong"
        >
          {state.message}
        </p>
      )}

      <div>
        <label htmlFor="full_name" className="block font-ui text-sm font-medium text-ink-strong">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          required
          aria-invalid={err.full_name ? true : undefined}
          aria-describedby={err.full_name ? "full_name-error" : undefined}
          className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
        />
        {err.full_name && (
          <p id="full_name-error" className="mt-1 font-ui text-xs text-cell-coral-text">
            {err.full_name}
          </p>
        )}
      </div>

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
          aria-invalid={err.email ? true : undefined}
          aria-describedby={err.email ? "email-error" : undefined}
          className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
        />
        {err.email && (
          <p id="email-error" className="mt-1 font-ui text-xs text-cell-coral-text">
            {err.email}
          </p>
        )}
      </div>

      <fieldset
        role="radiogroup"
        aria-invalid={err.class_section ? true : undefined}
        aria-describedby={err.class_section ? "class_section-error" : undefined}
      >
        <legend className="block font-ui text-sm font-medium text-ink-strong">Class</legend>
        <div className="mt-2 flex gap-4">
          {(["A1", "A2"] as const).map((c) => (
            <label key={c} className="flex min-h-11 items-center gap-2 py-1.5 font-ui text-sm text-ink-body">
              <input
                type="radio"
                name="class_section"
                value={c}
                required
                className="h-4 w-4"
              />
              {c}
            </label>
          ))}
        </div>
        {err.class_section && (
          <p id="class_section-error" className="mt-1 font-ui text-xs text-cell-coral-text">
            {err.class_section}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor="year_joined" className="block font-ui text-sm font-medium text-ink-strong">
          Year you joined the Research Cell
        </label>
        <select
          id="year_joined"
          name="year_joined"
          required
          defaultValue=""
          aria-invalid={err.year_joined ? true : undefined}
          aria-describedby={
            err.year_joined ? "year_joined-hint year_joined-error" : "year_joined-hint"
          }
          className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
        >
          <option value="" disabled>
            Select a year
          </option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <p id="year_joined-hint" className="mt-1 font-ui text-xs text-ink-muted">
          The year you actually joined, which may not be this year.
        </p>
        {err.year_joined && (
          <p id="year_joined-error" className="mt-1 font-ui text-xs text-cell-coral-text">
            {err.year_joined}
          </p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
