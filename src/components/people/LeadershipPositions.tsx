"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  assignLeadershipPosition,
  createLeadershipPosition,
  deleteLeadershipPosition,
  updateLeadershipPosition,
  vacateLeadershipPosition,
  type PeopleFormState,
} from "@/lib/people/actions";

/**
 * Leadership positions.
 *
 * A position is a record that exists whether or not anybody holds it, so the
 * management area is where positions are created, renamed, filled and emptied.
 * Titles are typed by hand: there is no fixed list and no limit on how many
 * positions the Research Cell has.
 *
 * Nothing here writes to a table. Every button calls a database function,
 * because changing who holds a position is also what records the appointment
 * that ended — the two cannot be allowed to come apart.
 */

const initial: PeopleFormState = { ok: false };

const field =
  "mt-1 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm text-ink-strong";
const label = "block font-ui text-xs text-ink-muted";

function Notice({ state }: { state: PeopleFormState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`mt-2 rounded px-3 py-2 font-ui text-sm ${
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
  label: text,
  busy,
  tone = "quiet",
}: {
  label: string;
  busy: string;
  tone?: "primary" | "quiet";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded px-3 py-2 font-ui text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        tone === "primary"
          ? "bg-cell-ink text-white hover:bg-cell-ink-deep"
          : "border border-border-subtle text-ink-body hover:border-lgs-500 hover:text-lgs-600"
      }`}
    >
      {pending ? busy : text}
    </button>
  );
}

export type Position = {
  id: string;
  title: string;
  display_order: number;
  person_id: string | null;
  holder_name: string | null;
  academic_year: string | null;
};

export type Candidate = { id: string; full_name: string };

function PositionCard({
  position,
  candidates,
}: {
  position: Position;
  candidates: Candidate[];
}) {
  const [renameState, rename] = useActionState(updateLeadershipPosition, initial);
  const [assignState, assign] = useActionState(assignLeadershipPosition, initial);
  const [vacateState, vacate] = useActionState(vacateLeadershipPosition, initial);
  const [removeState, remove] = useActionState(deleteLeadershipPosition, initial);

  const held = position.person_id !== null;

  return (
    <li className="rounded-lg border border-border-subtle bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-heading text-lg font-bold text-ink-strong">{position.title}</p>
          <p className="mt-0.5 font-ui text-sm text-ink-body">
            {held ? (
              <>
                {position.holder_name}
                {position.academic_year ? (
                  <span className="text-ink-muted"> · {position.academic_year}</span>
                ) : null}
              </>
            ) : (
              <span className="text-ink-muted">Vacant</span>
            )}
          </p>
        </div>
        <span className="font-ui text-xs text-ink-muted">
          Order {position.display_order}
        </span>
      </div>

      {/* Who holds it */}
      {held ? (
        <form action={vacate} className="mt-4">
          <input type="hidden" name="position_id" value={position.id} />
          <Busy label="Vacate" busy="Vacating…" />
          <span className="ml-3 font-ui text-xs text-ink-muted">
            The appointment is kept in the leadership history.
          </span>
        </form>
      ) : (
        <form action={assign} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="position_id" value={position.id} />
          <div className="min-w-56">
            <label htmlFor={`assign-${position.id}`} className={label}>
              Assign to
            </label>
            <select
              id={`assign-${position.id}`}
              name="person_id"
              required
              defaultValue=""
              className={field}
            >
              <option value="" disabled>
                Choose a person…
              </option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
          <Busy label="Assign" busy="Assigning…" tone="primary" />
        </form>
      )}
      <Notice state={assignState} />
      <Notice state={vacateState} />

      {/* Title and order */}
      <form action={rename} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border-subtle pt-4">
        <input type="hidden" name="position_id" value={position.id} />
        <div className="min-w-56 flex-1">
          <label htmlFor={`title-${position.id}`} className={label}>
            Title
          </label>
          <input
            id={`title-${position.id}`}
            name="title"
            defaultValue={position.title}
            required
            className={field}
          />
        </div>
        <div className="w-24">
          <label htmlFor={`order-${position.id}`} className={label}>
            Order
          </label>
          <input
            id={`order-${position.id}`}
            name="display_order"
            type="number"
            defaultValue={position.display_order}
            className={field}
          />
        </div>
        <Busy label="Save" busy="Saving…" />
      </form>
      <Notice state={renameState} />

      {!held && (
        <>
          <form action={remove} className="mt-4">
            <input type="hidden" name="position_id" value={position.id} />
            <button
              type="submit"
              className="rounded border border-border-subtle px-3 py-1.5 font-ui text-xs text-ink-body transition-colors hover:border-cell-coral hover:text-cell-coral-text"
            >
              Delete this position
            </button>
          </form>
          <Notice state={removeState} />
        </>
      )}
    </li>
  );
}

export function LeadershipPositions({
  positions,
  candidates,
}: {
  positions: Position[];
  candidates: Candidate[];
}) {
  const [addState, add] = useActionState(createLeadershipPosition, initial);

  return (
    <>
      {positions.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-border-subtle p-8 text-center text-sm text-ink-muted">
          No leadership positions have been created yet.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {positions.map((p) => (
            <PositionCard key={p.id} position={p} candidates={candidates} />
          ))}
        </ul>
      )}

      <form action={add} className="mt-6 max-w-2xl rounded-lg border border-border-subtle bg-surface p-5">
        <h3 className="font-ui text-sm font-semibold text-ink-strong">Add a position</h3>
        <p className="mt-1 font-ui text-xs text-ink-muted">
          Created vacant. Assign someone to it afterwards.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label htmlFor="new-position-title" className={label}>
              Title
            </label>
            <input
              id="new-position-title"
              name="title"
              required
              placeholder="Head of Outreach"
              className={field}
            />
          </div>
          <div className="w-24">
            <label htmlFor="new-position-order" className={label}>
              Order
            </label>
            <input
              id="new-position-order"
              name="display_order"
              type="number"
              defaultValue={0}
              className={field}
            />
          </div>
          <Busy label="Add" busy="Adding…" tone="primary" />
        </div>
        <Notice state={addState} />
      </form>
    </>
  );
}
