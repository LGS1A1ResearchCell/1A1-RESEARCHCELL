"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  addCoAuthor,
  advanceSubmission,
  confirmAuthorship,
  removeCoAuthor,
  searchMembers,
  uploadResearchDocument,
  type ResearchFormState,
} from "@/lib/research/actions";

const initial: ResearchFormState = { ok: false };

export type Author = {
  person_id: string;
  author_role: string;
  author_order: number;
  confirmation_status: string;
  confirmed_at: string | null;
  full_name: string;
};

function Busy({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-cell-ink px-4 py-2 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? busy : label}
    </button>
  );
}

function Notice({ state }: { state: ResearchFormState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`mt-3 rounded px-3 py-2.5 font-ui text-sm leading-relaxed ${
        state.ok
          ? "border border-lgs-200 bg-lgs-50 text-ink-strong"
          : "border border-cell-coral/40 bg-cell-coral/5 text-ink-strong"
      }`}
    >
      {state.message}
    </p>
  );
}

// -----------------------------------------------------------------------------

export function DocumentUpload({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(uploadResearchDocument, initial);
  return (
    <form action={action}>
      <input type="hidden" name="project_id" value={projectId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="document" className="block font-ui text-sm font-medium text-ink-strong">
            Upload your paper
          </label>
          <input
            id="document" name="document" type="file" required
            accept=".pdf,.doc,.docx,application/pdf"
            className="mt-1.5 block w-full font-ui text-sm text-ink-body file:mr-3 file:rounded file:border-0 file:bg-surface-sunken file:px-3 file:py-2 file:font-ui file:text-sm file:font-semibold file:text-ink-strong"
          />
        </div>
        <Busy label="Upload" busy="Uploading…" />
      </div>
      <div className="mt-3">
        <label htmlFor="notes" className="block font-ui text-xs text-ink-muted">
          What changed in this version? (optional)
        </label>
        <input
          id="notes" name="notes" type="text"
          className="mt-1 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm text-ink-strong"
        />
      </div>
      <p className="mt-2 font-ui text-xs text-ink-muted">
        PDF or Word, up to 50 MB. Each upload is kept as a new version; nothing
        you have already submitted is replaced.
      </p>
      <Notice state={state} />
    </form>
  );
}

// -----------------------------------------------------------------------------

export function AuthorManager({
  projectId,
  authors,
  frozen,
}: {
  projectId: string;
  authors: Author[];
  frozen: boolean;
}) {
  const [addState, add] = useActionState(addCoAuthor, initial);
  const [removeState, remove] = useActionState(removeCoAuthor, initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; full_name: string; class_section: string | null }[]>([]);
  const [searching, startSearch] = useTransition();

  const runSearch = (q: string) => {
    setQuery(q);
    startSearch(async () => {
      const found = await searchMembers(q);
      const already = new Set(authors.map((a) => a.person_id));
      setResults(found.filter((m) => !already.has(m.id)));
    });
  };

  return (
    <div>
      {frozen && (
        <p className="mb-4 rounded border border-border-subtle bg-surface-muted px-3 py-2.5 font-ui text-xs leading-relaxed text-ink-muted">
          The author list is fixed: a co-author has confirmed their authorship.
          Ask school administration if a correction is needed.
        </p>
      )}

      <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
        {authors.map((a) => (
          <li key={a.person_id} className="flex flex-wrap items-center gap-3 p-3.5">
            <div className="min-w-0 flex-1">
              <p className="font-ui text-sm font-semibold text-ink-strong">{a.full_name}</p>
              <p className="font-ui text-xs text-ink-muted">
                {a.author_role === "team_leader"
                  ? "Team Leader"
                  : a.author_role === "sole_author"
                    ? "Sole author"
                    : "Co-author"}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 font-ui text-xs font-medium ${
                a.confirmation_status === "confirmed"
                  ? "bg-lgs-100 text-lgs-700"
                  : a.confirmation_status === "declined"
                    ? "bg-cell-coral/10 text-cell-coral"
                    : "bg-surface-sunken text-ink-muted"
              }`}
            >
              {a.confirmation_status === "confirmed"
                ? "Confirmed"
                : a.confirmation_status === "declined"
                  ? "Declined"
                  : "Awaiting confirmation"}
            </span>
            {!frozen && a.author_role === "co_author" && (
              <form action={remove}>
                <input type="hidden" name="project_id" value={projectId} />
                <input type="hidden" name="person_id" value={a.person_id} />
                <button
                  type="submit"
                  className="rounded border border-border-subtle px-2.5 py-1 font-ui text-xs text-ink-body transition-colors hover:border-cell-coral hover:text-cell-coral"
                >
                  Remove
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <Notice state={removeState} />

      {!frozen && (
        <div className="mt-5">
          <label htmlFor="member-search" className="block font-ui text-sm font-medium text-ink-strong">
            Add an author
          </label>
          <input
            id="member-search"
            type="search"
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            onFocus={() => results.length === 0 && runSearch("")}
            placeholder="Search Research Cell members by name"
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
          />
          <p className="mt-1 font-ui text-xs text-ink-muted">
            Only members with an active account appear here — an author must be
            able to confirm.
          </p>

          {searching && <p className="mt-2 font-ui text-xs text-ink-muted">Searching…</p>}

          {results.length > 0 && (
            <ul className="mt-2 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
              {results.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 p-3">
                  <span className="min-w-0">
                    <span className="block font-ui text-sm text-ink-strong">{m.full_name}</span>
                    {m.class_section && (
                      <span className="block font-ui text-xs text-ink-muted">Class {m.class_section}</span>
                    )}
                  </span>
                  <form action={add}>
                    <input type="hidden" name="project_id" value={projectId} />
                    <input type="hidden" name="person_id" value={m.id} />
                    <button
                      type="submit"
                      className="rounded border border-lgs-500 px-3 py-1.5 font-ui text-xs font-semibold text-lgs-600 transition-colors hover:bg-lgs-50"
                    >
                      Add
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <Notice state={addState} />
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------

export function ConfirmAuthorship({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(confirmAuthorship, initial);

  return (
    <div className="rounded-lg border border-cell-coral/40 bg-cell-coral/5 p-5">
      <h2 className="font-heading text-lg font-bold text-ink-strong">
        Confirm your authorship
      </h2>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-body">
        You have been named as an author on this submission. It cannot go to
        review until you confirm. Only you can answer this — the Team Leader
        cannot do it on your behalf.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <form action={action}>
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="decision" value="confirmed" />
          <Busy label="Yes, I am an author" busy="Recording…" />
        </form>
        <form action={action}>
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="decision" value="declined" />
          <button
            type="submit"
            className="rounded border border-border-subtle px-4 py-2 font-ui text-sm font-semibold text-ink-body transition-colors hover:border-cell-coral hover:text-cell-coral"
          >
            No, I am not
          </button>
        </form>
      </div>
      <Notice state={state} />
    </div>
  );
}

// -----------------------------------------------------------------------------

export function AdvanceControls({
  projectId,
  status,
  isTeam,
  unconfirmed,
  hasDocument,
}: {
  projectId: string;
  status: string;
  isTeam: boolean;
  unconfirmed: number;
  hasDocument: boolean;
}) {
  const [state, action] = useActionState(advanceSubmission, initial);

  const next =
    status === "draft"
      ? isTeam
        ? { target: "awaiting_author_confirmation", label: "Send to authors for confirmation" }
        : { target: "submitted", label: "Submit for review" }
      : status === "awaiting_author_confirmation"
        ? { target: "submitted", label: "Submit for review" }
        : status === "revision_required"
          ? { target: "submitted", label: "Submit revised version" }
          : null;

  if (!next) return null;

  const blockedReason = !hasDocument
    ? "Upload your paper before submitting it."
    : next.target === "submitted" && isTeam && unconfirmed > 0
      ? `${unconfirmed} author${unconfirmed === 1 ? "" : "s"} still need to confirm.`
      : null;

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="status" value={next.target} />
        <button
          type="submit"
          disabled={!!blockedReason}
          className="rounded bg-cell-ink px-5 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {next.label}
        </button>
      </form>
      {blockedReason && (
        <p className="mt-2 font-ui text-xs text-ink-muted">{blockedReason}</p>
      )}
      <Notice state={state} />
    </div>
  );
}
