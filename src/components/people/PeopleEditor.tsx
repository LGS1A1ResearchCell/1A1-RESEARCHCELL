"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createPerson,
  deletePerson,
  movePersonToPast,
  returnPersonToCurrent,
  updatePerson,
  type PeopleFormState,
} from "@/lib/people/actions";

const initial: PeopleFormState = { ok: false };

const field =
  "mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong";
const labelClass = "block font-ui text-sm font-medium text-ink-strong";

export type Person = {
  id: string;
  full_name: string;
  status: "student" | "leadership" | null;
  leadership_title: string | null;
  academic_year_text: string | null;
  moved_to_past_at: string | null;
};

function Notice({ state }: { state: PeopleFormState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`mt-3 rounded px-3 py-2 font-ui text-sm ${
        state.ok
          ? "border border-lgs-200 bg-lgs-50 text-ink-strong"
          : "border border-cell-coral/40 bg-cell-coral/5 text-ink-strong"
      }`}
    >
      {state.message}
    </p>
  );
}

function Busy({
  label,
  busy,
  tone = "primary",
}: {
  label: string;
  busy: string;
  tone?: "primary" | "quiet" | "danger";
}) {
  const { pending } = useFormStatus();
  const styles =
    tone === "primary"
      ? "bg-cell-ink text-white hover:bg-cell-ink-deep"
      : tone === "danger"
        ? "border border-border-subtle text-ink-body hover:border-cell-coral hover:text-cell-coral-text"
        : "border border-border-subtle text-ink-body hover:border-lgs-500 hover:text-lgs-600";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded px-4 py-2 font-ui text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles}`}
    >
      {pending ? busy : label}
    </button>
  );
}

/**
 * The fields of a person, shared by the create form and each edit form.
 *
 * The leadership title appears only when the status is leadership, and it is
 * removed from the page rather than merely hidden — a hidden input would still
 * be submitted. The database refuses a title on a student regardless, so this
 * is about not asking a confusing question, not about enforcement.
 */
function PersonFields({
  person,
  idPrefix,
  errors,
}: {
  person?: Person;
  idPrefix: string;
  errors: Record<string, string>;
}) {
  const [status, setStatus] = useState<string>(person?.status ?? "student");
  const isLeadership = status === "leadership";

  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-name`} className={labelClass}>
          Name
        </label>
        <input
          id={`${idPrefix}-name`}
          name="full_name"
          defaultValue={person?.full_name ?? ""}
          required
          aria-invalid={errors.full_name ? true : undefined}
          aria-describedby={errors.full_name ? `${idPrefix}-name-error` : undefined}
          className={field}
        />
        {errors.full_name && (
          <p id={`${idPrefix}-name-error`} className="mt-1 font-ui text-xs text-cell-coral-text">
            {errors.full_name}
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-status`} className={labelClass}>
            Status
          </label>
          <select
            id={`${idPrefix}-status`}
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={field}
          >
            <option value="student">Student</option>
            <option value="leadership">Leadership</option>
          </select>
          {errors.status && (
            <p className="mt-1 font-ui text-xs text-cell-coral-text">{errors.status}</p>
          )}
        </div>

        <div>
          <label htmlFor={`${idPrefix}-year`} className={labelClass}>
            Academic year
          </label>
          <input
            id={`${idPrefix}-year`}
            name="academic_year_text"
            defaultValue={person?.academic_year_text ?? ""}
            required
            placeholder="2025-26"
            aria-invalid={errors.academic_year_text ? true : undefined}
            className={field}
          />
          <p className="mt-1 font-ui text-xs text-ink-muted">
            Shown exactly as you type it. A member spanning two years is written
            as you want it read, for example 2025-27.
          </p>
          {errors.academic_year_text && (
            <p className="mt-1 font-ui text-xs text-cell-coral-text">
              {errors.academic_year_text}
            </p>
          )}
        </div>
      </div>

      {isLeadership && (
        <div className="mt-4">
          <label htmlFor={`${idPrefix}-title`} className={labelClass}>
            Leadership title
          </label>
          <input
            id={`${idPrefix}-title`}
            name="leadership_title"
            defaultValue={person?.leadership_title ?? ""}
            className={field}
          />
          <p className="mt-1 font-ui text-xs text-ink-muted">
            Written by hand. There is no fixed list and no limit on how many
            people hold a title.
          </p>
        </div>
      )}
    </>
  );
}

// -----------------------------------------------------------------------------

export function NewPersonForm() {
  const [state, action] = useActionState(createPerson, initial);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action}>
      <PersonFields idPrefix="new" errors={errors} />
      <div className="mt-5">
        <Busy label="Add person" busy="Adding…" />
      </div>
      <Notice state={state} />
    </form>
  );
}

// -----------------------------------------------------------------------------

export function PersonRow({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const [saveState, save] = useActionState(updatePerson, initial);
  const [moveState, move] = useActionState(movePersonToPast, initial);
  const [removeState, remove] = useActionState(deletePerson, initial);
  const [returnState, bringBack] = useActionState(returnPersonToCurrent, initial);
  const errors = saveState.fieldErrors ?? {};
  const isPast = Boolean(person.moved_to_past_at);

  return (
    <li className="rounded-lg border border-border-subtle bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 className="font-ui text-sm font-semibold text-ink-strong">
            {person.full_name}
          </h3>
          <p className="font-ui text-xs text-ink-muted">
            {[
              person.status === "leadership"
                ? person.leadership_title || "Leadership"
                : "Student",
              person.academic_year_text,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 font-ui text-xs font-medium ${
              isPast ? "bg-surface-sunken text-ink-muted" : "bg-lgs-100 text-lgs-700"
            }`}
          >
            {isPast ? "Past" : "Current"}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="rounded border border-border-subtle px-3 py-1.5 font-ui text-xs font-semibold text-ink-body"
          >
            {open ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border-subtle p-4">
          <form action={save}>
            <input type="hidden" name="person_id" value={person.id} />
            <PersonFields person={person} idPrefix={`p-${person.id}`} errors={errors} />
            <div className="mt-5">
              <Busy label="Save changes" busy="Saving…" />
            </div>
            <Notice state={saveState} />
          </form>

          <div className="mt-5 flex flex-wrap gap-3 border-t border-border-subtle pt-4">
            {isPast ? (
              <form action={bringBack}>
                <input type="hidden" name="person_id" value={person.id} />
                <Busy label="Return to current" busy="Returning…" tone="quiet" />
              </form>
            ) : (
              <form action={move}>
                <input type="hidden" name="person_id" value={person.id} />
                <Busy label="Move to past" busy="Moving…" tone="quiet" />
              </form>
            )}
            <form action={remove}>
              <input type="hidden" name="person_id" value={person.id} />
              <Busy label="Delete" busy="Removing…" tone="danger" />
            </form>
          </div>
          <Notice state={moveState} />
          <Notice state={returnState} />
          <Notice state={removeState} />
        </div>
      )}
    </li>
  );
}
