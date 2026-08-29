"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { setProfileVisibility, type PeopleActionState } from "@/lib/admin/people-actions";

const initial: PeopleActionState = { ok: false };

function Toggle({ isPublic }: { isPublic: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded border px-3 py-1.5 font-ui text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        isPublic
          ? "border-border-subtle text-ink-body hover:border-cell-coral hover:text-cell-coral"
          : "border-lgs-500 text-lgs-600 hover:bg-lgs-50"
      }`}
    >
      {pending ? "Saving…" : isPublic ? "Make private" : "Make public"}
    </button>
  );
}

export function VisibilityToggle({
  personId,
  isPublic,
}: {
  personId: string;
  isPublic: boolean;
}) {
  const [state, action] = useActionState(setProfileVisibility, initial);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="person_id" value={personId} />
        <input type="hidden" name="is_public" value={String(!isPublic)} />
        <Toggle isPublic={isPublic} />
      </form>
      {state.message && !state.ok && (
        <p role="alert" className="font-ui text-xs text-cell-coral">
          {state.message}
        </p>
      )}
    </div>
  );
}
