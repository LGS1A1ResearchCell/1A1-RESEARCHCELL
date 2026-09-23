"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createResearchDraft, type ResearchFormState } from "@/lib/research/actions";

const initial: ResearchFormState = { ok: false };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 rounded bg-cell-ink px-5 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create draft"}
    </button>
  );
}

export function NewResearchForm() {
  const [state, action] = useActionState(createResearchDraft, initial);
  const err = state.fieldErrors ?? {};

  return (
    <form action={action}>
      <label htmlFor="title" className="block font-ui text-sm font-medium text-ink-strong">
        Title
      </label>
      <input
        id="title"
        name="title"
        required
        autoFocus
        aria-invalid={err.title ? true : undefined}
        aria-describedby={err.title ? "title-error" : undefined}
        className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
      />
      {err.title && (
        <p id="title-error" role="alert" className="mt-1 font-ui text-xs text-cell-coral-text">
          {err.title}
        </p>
      )}

      {state.message && (
        <p role="alert" className="mt-3 rounded border border-cell-coral/40 bg-cell-coral/5 px-3 py-2 font-ui text-sm text-ink-strong">
          {state.message}
        </p>
      )}

      <Submit />
    </form>
  );
}
