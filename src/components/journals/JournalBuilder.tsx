"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  addJournalCredit,
  addPaperToJournal,
  approveCorrection,
  publishJournal,
  recordCorrection,
  removeJournalCredit,
  removePaperFromJournal,
  reorderPaper,
  setPaperPages,
  submitJournalForApproval,
  updateJournalDetails,
  uploadJournalAsset,
  withdrawJournalSubmission,
  type JournalFormState,
} from "@/lib/journals/actions";

const initial: JournalFormState = { ok: false };

function Notice({ state }: { state: JournalFormState }) {
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

function Busy({ label, busy, tone = "primary" }: { label: string; busy: string; tone?: "primary" | "quiet" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded px-4 py-2 font-ui text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        tone === "primary"
          ? "bg-cell-ink text-white hover:bg-cell-ink-deep"
          : "border border-border-subtle text-ink-body hover:border-lgs-500 hover:text-lgs-600"
      }`}
    >
      {pending ? busy : label}
    </button>
  );
}

export type JournalPaper = {
  project_id: string;
  title: string;
  display_order: number;
  start_page: number | null;
  end_page: number | null;
  authors: string;
};

export type Candidate = { id: string; title: string; authors: string };
export type Credit = { id: string; person_id: string; credit_title: string; full_name: string };
export type Member = { id: string; full_name: string };
export type Correction = {
  id: string;
  description: string;
  approved_at: string | null;
  created_at: string;
};

// -----------------------------------------------------------------------------

export function JournalDetailsForm({
  journalId, title, volumeLabel, description, locked,
}: {
  journalId: string; title: string; volumeLabel: string; description: string; locked: boolean;
}) {
  const [state, action] = useActionState(updateJournalDetails, initial);
  if (locked) return null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="journal_id" value={journalId} />
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <div>
          <label htmlFor="j-title" className="block font-ui text-sm font-medium text-ink-strong">Title</label>
          <input id="j-title" name="title" defaultValue={title}
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong" />
        </div>
        <div>
          <label htmlFor="j-vol" className="block font-ui text-sm font-medium text-ink-strong">Volume</label>
          <input id="j-vol" name="volume_label" defaultValue={volumeLabel} placeholder="II"
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong" />
        </div>
      </div>
      <div>
        <label htmlFor="j-desc" className="block font-ui text-sm font-medium text-ink-strong">Description</label>
        <textarea id="j-desc" name="description" rows={3} defaultValue={description}
          className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong" />
      </div>
      <Busy label="Save details" busy="Saving…" />
      <Notice state={state} />
    </form>
  );
}

// -----------------------------------------------------------------------------

export function PaperManager({
  journalId, papers, candidates, locked,
}: {
  journalId: string; papers: JournalPaper[]; candidates: Candidate[]; locked: boolean;
}) {
  const [addState, add] = useActionState(addPaperToJournal, initial);
  const [rmState, rm] = useActionState(removePaperFromJournal, initial);
  const [moveState, move] = useActionState(reorderPaper, initial);
  const [pageState, pages] = useActionState(setPaperPages, initial);

  return (
    <div>
      {papers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-subtle bg-surface p-6 text-center text-sm text-ink-muted">
          No papers yet. A journal needs at least one before it can be submitted.
        </p>
      ) : (
        <ol className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
          {papers.map((p, i) => (
            <li key={p.project_id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-heading text-base font-bold text-ink-strong">
                    <span className="mr-2 font-ui text-sm font-normal text-ink-muted">{i + 1}.</span>
                    {p.title}
                  </h3>
                  <p className="mt-1 font-ui text-xs text-ink-muted">{p.authors}</p>
                </div>

                {!locked && (
                  <div className="flex shrink-0 gap-1.5">
                    <form action={move}>
                      <input type="hidden" name="journal_id" value={journalId} />
                      <input type="hidden" name="project_id" value={p.project_id} />
                      <input type="hidden" name="direction" value="up" />
                      <button type="submit" disabled={i === 0} aria-label={`Move ${p.title} up`}
                        className="rounded border border-border-subtle px-2 py-1 font-ui text-xs text-ink-body disabled:opacity-40">↑</button>
                    </form>
                    <form action={move}>
                      <input type="hidden" name="journal_id" value={journalId} />
                      <input type="hidden" name="project_id" value={p.project_id} />
                      <input type="hidden" name="direction" value="down" />
                      <button type="submit" disabled={i === papers.length - 1} aria-label={`Move ${p.title} down`}
                        className="rounded border border-border-subtle px-2 py-1 font-ui text-xs text-ink-body disabled:opacity-40">↓</button>
                    </form>
                    <form action={rm}>
                      <input type="hidden" name="journal_id" value={journalId} />
                      <input type="hidden" name="project_id" value={p.project_id} />
                      <button type="submit"
                        className="rounded border border-border-subtle px-2.5 py-1 font-ui text-xs text-ink-body hover:border-cell-coral hover:text-cell-coral-text">
                        Remove
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {locked ? (
                (p.start_page || p.end_page) && (
                  <p className="mt-2 font-ui text-xs text-ink-muted">
                    Pages {p.start_page}&ndash;{p.end_page}
                  </p>
                )
              ) : (
                <form action={pages} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="journal_id" value={journalId} />
                  <input type="hidden" name="project_id" value={p.project_id} />
                  <div>
                    <label htmlFor={`sp-${p.project_id}`} className="block font-ui text-xs text-ink-muted">First page</label>
                    <input id={`sp-${p.project_id}`} name="start_page" type="number" min="1"
                      defaultValue={p.start_page ?? ""}
                      className="mt-1 w-24 rounded border border-border-subtle bg-surface px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label htmlFor={`ep-${p.project_id}`} className="block font-ui text-xs text-ink-muted">Last page</label>
                    <input id={`ep-${p.project_id}`} name="end_page" type="number" min="1"
                      defaultValue={p.end_page ?? ""}
                      className="mt-1 w-24 rounded border border-border-subtle bg-surface px-2 py-1.5 text-sm" />
                  </div>
                  <button type="submit"
                    className="rounded border border-border-subtle px-3 py-1.5 font-ui text-xs font-semibold text-ink-body hover:border-lgs-500 hover:text-lgs-600">
                    Save pages
                  </button>
                </form>
              )}
            </li>
          ))}
        </ol>
      )}
      <Notice state={rmState} />
      <Notice state={moveState} />
      <Notice state={pageState} />

      {!locked && (
        <div className="mt-5 rounded-lg border border-border-subtle bg-surface p-5">
          <h3 className="font-ui text-sm font-semibold text-ink-strong">Add approved research</h3>
          {candidates.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">
              No approved research is waiting to be placed. Papers appear here once
              the Research Cell has approved them and they are not already in a journal.
            </p>
          ) : (
            <form action={add} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="journal_id" value={journalId} />
              <div className="min-w-0 flex-1">
                <label htmlFor="add-paper" className="sr-only">Paper</label>
                <select id="add-paper" name="project_id" required defaultValue=""
                  className="w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm text-ink-strong">
                  <option value="" disabled>Select an approved paper…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.title} — {c.authors}</option>
                  ))}
                </select>
              </div>
              <Busy label="Add" busy="Adding…" tone="quiet" />
            </form>
          )}
          <Notice state={addState} />
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------

export function MastheadManager({
  journalId, credits, members, locked,
}: {
  journalId: string; credits: Credit[]; members: Member[]; locked: boolean;
}) {
  const [addState, add] = useActionState(addJournalCredit, initial);
  const [rmState, rm] = useActionState(removeJournalCredit, initial);

  return (
    <div>
      {credits.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-subtle bg-surface p-6 text-center text-sm text-ink-muted">
          No credits recorded yet.
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
          {credits.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
              <span className="font-ui text-sm text-ink-strong">
                <span className="font-bold text-lgs-600">{c.credit_title}</span>
                <span className="ml-2">{c.full_name}</span>
              </span>
              {!locked && (
                <form action={rm}>
                  <input type="hidden" name="journal_id" value={journalId} />
                  <input type="hidden" name="credit_id" value={c.id} />
                  <button type="submit"
                    className="rounded border border-border-subtle px-2.5 py-1 font-ui text-xs text-ink-body hover:border-cell-coral hover:text-cell-coral-text">
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <Notice state={rmState} />

      {!locked && (
        <form action={add} className="mt-5 rounded-lg border border-border-subtle bg-surface p-5">
          <input type="hidden" name="journal_id" value={journalId} />
          <h3 className="font-ui text-sm font-semibold text-ink-strong">Add a credit</h3>
          <p className="mt-1 font-ui text-xs text-ink-muted">
            Editorial roles are recorded against this issue and never change when
            Research Cell leadership changes.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label htmlFor="credit-person" className="block font-ui text-xs text-ink-muted">Person</label>
              <select id="credit-person" name="person_id" required defaultValue=""
                className="mt-1 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm">
                <option value="" disabled>Select…</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="credit-title" className="block font-ui text-xs text-ink-muted">Credit</label>
              <input id="credit-title" name="credit_title" required placeholder="Editor-in-Chief"
                className="mt-1 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm" />
            </div>
            <Busy label="Add" busy="Adding…" tone="quiet" />
          </div>
          <Notice state={addState} />
        </form>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------

export function AssetUpload({ journalId, hasCover, hasPdf, locked }: {
  journalId: string; hasCover: boolean; hasPdf: boolean; locked: boolean;
}) {
  const [state, action] = useActionState(uploadJournalAsset, initial);
  if (locked) {
    return (
      <p className="rounded border border-border-subtle bg-surface-muted px-3 py-2.5 font-ui text-xs text-ink-muted">
        This journal is published. Its cover and PDF are part of the public record
        and cannot be replaced.
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(["cover", "pdf"] as const).map((kind) => (
        <form key={kind} action={action} className="rounded-lg border border-border-subtle bg-surface p-4">
          <input type="hidden" name="journal_id" value={journalId} />
          <input type="hidden" name="kind" value={kind} />
          <label htmlFor={`f-${kind}`} className="block font-ui text-sm font-medium text-ink-strong">
            {kind === "cover" ? "Cover image" : "Final journal PDF"}
          </label>
          <p className="mt-1 font-ui text-xs text-ink-muted">
            {kind === "cover"
              ? (hasCover ? "A cover is set. Uploading replaces it." : "JPEG, PNG or WebP, up to 10 MB.")
              : (hasPdf ? "A PDF is set. Uploading replaces it." : "PDF, up to 100 MB.")}
          </p>
          <input id={`f-${kind}`} name="file" type="file" required
            accept={kind === "cover" ? "image/jpeg,image/png,image/webp" : "application/pdf"}
            className="mt-2 block w-full font-ui text-sm text-ink-body file:mr-3 file:rounded file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:font-ui file:text-sm file:font-semibold file:text-ink-strong" />
          <div className="mt-3">
            <Busy label="Upload" busy="Uploading…" tone="quiet" />
          </div>
        </form>
      ))}
      <div className="sm:col-span-2"><Notice state={state} /></div>
    </div>
  );
}

// -----------------------------------------------------------------------------

export function WorkflowPanel({
  journalId, status, paperCount, isSchoolAdmin,
}: {
  journalId: string; status: string; paperCount: number; isSchoolAdmin: boolean;
}) {
  const [subState, submit] = useActionState(submitJournalForApproval, initial);
  const [wdState, withdraw] = useActionState(withdrawJournalSubmission, initial);
  const [pubState, publish] = useActionState(publishJournal, initial);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-5">
      <h2 className="font-heading text-lg font-bold text-ink-strong">
        {status === "draft" ? "Ready for the school?"
          : status === "pending_admin_approval" ? "Awaiting school approval"
          : "Published"}
      </h2>

      {status === "draft" && (
        <>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-body">
            Submitting sends this to school administration. Only they can approve
            and publish it. You can withdraw it while it is still waiting.
          </p>
          <form action={submit} className="mt-4">
            <input type="hidden" name="journal_id" value={journalId} />
            <button type="submit" disabled={paperCount === 0}
              className="rounded bg-cell-ink px-5 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep disabled:cursor-not-allowed disabled:opacity-50">
              Submit for school approval
            </button>
          </form>
          {paperCount === 0 && (
            <p className="mt-2 font-ui text-xs text-ink-muted">
              Add at least one approved paper first.
            </p>
          )}
          <Notice state={subState} />
        </>
      )}

      {status === "pending_admin_approval" && (
        <>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-body">
            {isSchoolAdmin
              ? "Research Cell leadership has submitted this journal. Publishing makes it and its papers public, and cannot be undone."
              : "School administration has been asked to review this journal."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {isSchoolAdmin && (
              confirming ? (
                <form action={publish}>
                  <input type="hidden" name="journal_id" value={journalId} />
                  <Busy label="Yes, approve and publish" busy="Publishing…" />
                </form>
              ) : (
                <button type="button" onClick={() => setConfirming(true)}
                  className="rounded bg-cell-ink px-5 py-2.5 font-ui text-sm font-semibold text-white hover:bg-cell-ink-deep">
                  Approve and publish
                </button>
              )
            )}
            <form action={withdraw}>
              <input type="hidden" name="journal_id" value={journalId} />
              <Busy label="Withdraw" busy="Withdrawing…" tone="quiet" />
            </form>
          </div>
          <Notice state={pubState} />
          <Notice state={wdState} />
        </>
      )}

      {status === "published" && (
        <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-body">
          This journal is in the public archive. Its contents, masthead and details
          are fixed. Anything that needs correcting is recorded as a correction
          below, which becomes public once school administration approves it.
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------

export function CorrectionsPanel({
  journalId, corrections, isSchoolAdmin,
}: {
  journalId: string; corrections: Correction[]; isSchoolAdmin: boolean;
}) {
  const [recState, record] = useActionState(recordCorrection, initial);
  const [appState, approve] = useActionState(approveCorrection, initial);

  return (
    <div>
      {corrections.length > 0 && (
        <ul className="mb-5 space-y-3">
          {corrections.map((c) => (
            <li key={c.id} className="rounded-lg border border-border-subtle bg-surface p-4">
              <p className="text-sm leading-relaxed text-ink-body">{c.description}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-0.5 font-ui text-xs font-medium ${
                  c.approved_at ? "bg-lgs-100 text-lgs-700" : "bg-surface-sunken text-ink-muted"}`}>
                  {c.approved_at ? "Approved and public" : "Awaiting school approval"}
                </span>
                {!c.approved_at && isSchoolAdmin && (
                  <form action={approve}>
                    <input type="hidden" name="journal_id" value={journalId} />
                    <input type="hidden" name="correction_id" value={c.id} />
                    <button type="submit"
                      className="rounded border border-lgs-500 px-3 py-1.5 font-ui text-xs font-semibold text-lgs-600 hover:bg-lgs-50">
                      Approve correction
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Notice state={appState} />

      <form action={record} className="rounded-lg border border-border-subtle bg-surface p-5">
        <input type="hidden" name="journal_id" value={journalId} />
        <label htmlFor="corr" className="block font-ui text-sm font-medium text-ink-strong">
          Record a correction
        </label>
        <p className="mt-1 font-ui text-xs text-ink-muted">
          The published record is never rewritten. A correction is a new, separately
          approved fact about it.
        </p>
        <textarea id="corr" name="description" rows={3} required
          placeholder="Author name corrected on page 14."
          className="mt-2 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong" />
        <div className="mt-3">
          <Busy label="Record correction" busy="Recording…" tone="quiet" />
        </div>
        <Notice state={recState} />
      </form>
    </div>
  );
}
