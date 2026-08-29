"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { assignLeadership, type PeopleActionState } from "@/lib/admin/people-actions";

const initial: PeopleActionState = { ok: false };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-cell-ink px-4 py-2 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Recording…" : "Record appointment"}
    </button>
  );
}

export function LeadershipForm({
  people,
  years,
}: {
  people: { id: string; full_name: string }[];
  years: { id: string; label: string; is_current: boolean }[];
}) {
  const [state, action] = useActionState(assignLeadership, initial);
  const currentYear = years.find((y) => y.is_current);

  return (
    <form action={action} className="rounded-lg border border-border-subtle bg-surface p-5">
      {state.message && (
        <p
          role="status"
          className={`mb-4 rounded px-3 py-2 font-ui text-sm ${
            state.ok
              ? "border border-lgs-200 bg-lgs-50 text-ink-strong"
              : "border border-cell-coral/40 bg-cell-coral/5 text-ink-strong"
          }`}
        >
          {state.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="lead-person" className="block font-ui text-sm font-medium text-ink-strong">
            Person
          </label>
          <select
            id="lead-person"
            name="person_id"
            required
            defaultValue=""
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm text-ink-strong"
          >
            <option value="" disabled>Select…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="lead-role" className="block font-ui text-sm font-medium text-ink-strong">
            Role
          </label>
          <select
            id="lead-role"
            name="role"
            required
            defaultValue="head_of_research"
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm text-ink-strong"
          >
            <option value="head_of_research">Head of Research</option>
            <option value="deputy_head_of_research">Deputy Head of Research</option>
          </select>
        </div>

        <div>
          <label htmlFor="lead-year" className="block font-ui text-sm font-medium text-ink-strong">
            Academic year
          </label>
          <select
            id="lead-year"
            name="academic_year_id"
            required
            defaultValue={currentYear?.id ?? ""}
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm text-ink-strong"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}{y.is_current ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-3 font-ui text-xs text-ink-muted">
        One Head and one Deputy per academic year. Recording an appointment for a
        year that already has one replaces the holder and notes the change in the
        activity log; previous years are never altered.
      </p>

      <div className="mt-4">
        <Submit />
      </div>
    </form>
  );
}
