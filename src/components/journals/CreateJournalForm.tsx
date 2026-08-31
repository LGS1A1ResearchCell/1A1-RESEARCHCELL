"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createJournal, type JournalFormState } from "@/lib/journals/actions";

const initial: JournalFormState = { ok: false };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-cell-ink px-5 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create journal"}
    </button>
  );
}

export function CreateJournalForm({
  years,
}: {
  years: { id: string; label: string; is_current: boolean }[];
}) {
  const [state, action] = useActionState(createJournal, initial);
  const err = state.fieldErrors ?? {};

  if (years.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border-subtle bg-surface p-6 text-sm text-ink-muted">
        Every academic year on record already has a journal. Add a new academic
        year before starting another issue.
      </p>
    );
  }

  return (
    <form action={action} className="rounded-lg border border-border-subtle bg-surface p-5">
      {state.message && (
        <p
          role="alert"
          className="mb-4 rounded border border-cell-coral/40 bg-cell-coral/5 px-3 py-2.5 font-ui text-sm text-ink-strong"
        >
          {state.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem_12rem]">
        <div>
          <label htmlFor="nj-title" className="block font-ui text-sm font-medium text-ink-strong">
            Title
          </label>
          <input
            id="nj-title"
            name="title"
            required
            placeholder="Journal II"
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
          />
          {err.title && <p className="mt-1 font-ui text-xs text-cell-coral">{err.title}</p>}
        </div>

        <div>
          <label htmlFor="nj-vol" className="block font-ui text-sm font-medium text-ink-strong">
            Volume
          </label>
          <input
            id="nj-vol"
            name="volume_label"
            placeholder="II"
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
          />
        </div>

        <div>
          <label htmlFor="nj-year" className="block font-ui text-sm font-medium text-ink-strong">
            Academic year
          </label>
          <select
            id="nj-year"
            name="academic_year_id"
            required
            defaultValue={years.find((y) => y.is_current)?.id ?? years[0]?.id}
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
                {y.is_current ? " (current)" : ""}
              </option>
            ))}
          </select>
          {err.academic_year_id && (
            <p className="mt-1 font-ui text-xs text-cell-coral">{err.academic_year_id}</p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="nj-desc"
          className="mt-4 block font-ui text-sm font-medium text-ink-strong"
        >
          Description <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <textarea
          id="nj-desc"
          name="description"
          rows={2}
          className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
        />
      </div>

      <p className="mt-3 font-ui text-xs text-ink-muted">
        Only years without a journal are listed: the archive holds one issue per
        academic year.
      </p>

      <div className="mt-4">
        <Submit />
      </div>
    </form>
  );
}
