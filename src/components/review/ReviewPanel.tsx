"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  recordReview,
  reopenForRevision,
  type ReviewFormState,
} from "@/lib/review/actions";

const initial: ReviewFormState = { ok: false };

function Notice({ state }: { state: ReviewFormState }) {
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

function Submit({ label, busy, tone }: { label: string; busy: string; tone: "approve" | "revise" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded px-5 py-2.5 font-ui text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        tone === "approve"
          ? "bg-cell-ink text-white hover:bg-cell-ink-deep"
          : "border border-cell-coral text-cell-coral hover:bg-cell-coral/5"
      }`}
    >
      {pending ? busy : label}
    </button>
  );
}

/**
 * The reviewer's decision.
 *
 * Only two outcomes exist, and the form offers only those two: there is no
 * rejection, by design. Feedback is required to request a revision and the
 * button stays disabled until it is written — the database enforces the same
 * rule, so this is a courtesy rather than the control.
 */
export function ReviewPanel({
  versionId,
  versionNumber,
  authorIsReviewer,
}: {
  versionId: string;
  versionNumber: number;
  authorIsReviewer: boolean;
}) {
  const [state, action] = useActionState(recordReview, initial);
  const [feedback, setFeedback] = useState("");

  if (authorIsReviewer) {
    return (
      <div className="rounded-lg border border-cell-coral/40 bg-cell-coral/5 p-5">
        <h2 className="font-heading text-lg font-bold text-ink-strong">
          You cannot review this submission
        </h2>
        <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-body">
          You are named as an author. Another member of Research Cell leadership,
          or school administration, must decide it.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-5">
      <h2 className="font-heading text-lg font-bold text-ink-strong">
        Your decision on version {versionNumber}
      </h2>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-body">
        A version carries one decision. If more work is needed after this, the
        authors submit a new version and that version is reviewed in turn.
      </p>

      <div className="mt-5">
        <label htmlFor="feedback" className="block font-ui text-sm font-medium text-ink-strong">
          Feedback for the authors
        </label>
        <textarea
          id="feedback"
          rows={5}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          aria-describedby="feedback-hint"
          className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
        />
        <p id="feedback-hint" className="mt-1.5 font-ui text-xs text-ink-muted">
          Required when requesting a revision. Optional, but welcome, when
          approving. The authors read this on their own submission; it is never
          written onto their document.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <form action={action}>
          <input type="hidden" name="version_id" value={versionId} />
          <input type="hidden" name="decision" value="revision_required" />
          <input type="hidden" name="feedback" value={feedback} />
          <span className={feedback.trim() ? "" : "cursor-not-allowed"}>
            <fieldset disabled={!feedback.trim()} className="contents">
              <Submit label="Request a revision" busy="Recording…" tone="revise" />
            </fieldset>
          </span>
        </form>

        <form action={action}>
          <input type="hidden" name="version_id" value={versionId} />
          <input type="hidden" name="decision" value="approved" />
          <input type="hidden" name="feedback" value={feedback} />
          <Submit label="Approve" busy="Recording…" tone="approve" />
        </form>
      </div>

      {!feedback.trim() && (
        <p className="mt-2 font-ui text-xs text-ink-muted">
          Write feedback to request a revision.
        </p>
      )}

      <Notice state={state} />
    </div>
  );
}

/** Reopening an approved paper before publication. */
export function ReopenPanel({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(reopenForRevision, initial);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-5">
      <h2 className="font-heading text-lg font-bold text-ink-strong">
        This research is approved
      </h2>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-body">
        The authors can no longer change it. If a correction is needed before it
        appears in a journal, you can reopen it for revision — the approval is
        withdrawn and the work needs approving again afterwards. The reviews
        already recorded stay in the history.
      </p>

      {confirming ? (
        <form action={action} className="mt-4 flex flex-wrap gap-3">
          <input type="hidden" name="project_id" value={projectId} />
          <button
            type="submit"
            className="rounded border border-cell-coral px-4 py-2 font-ui text-sm font-semibold text-cell-coral transition-colors hover:bg-cell-coral/5"
          >
            Yes, reopen for revision
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded border border-border-subtle px-4 py-2 font-ui text-sm font-semibold text-ink-body"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded border border-border-subtle px-4 py-2 font-ui text-sm font-semibold text-ink-body transition-colors hover:border-cell-coral hover:text-cell-coral"
        >
          Reopen for revision
        </button>
      )}

      <Notice state={state} />
    </div>
  );
}
