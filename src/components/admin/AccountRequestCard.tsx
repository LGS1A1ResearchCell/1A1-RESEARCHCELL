"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  approveAccountRequest,
  declineAccountRequest,
  type AdminActionState,
} from "@/lib/admin/account-actions";

const initial: AdminActionState = { ok: false };

export type PendingRequest = {
  id: string;
  full_name: string;
  email: string;
  class_section: string;
  year_joined: number;
  created_at: string;
};

function Submit({ label, busy, tone }: { label: string; busy: string; tone: "primary" | "quiet" }) {
  const { pending } = useFormStatus();
  const cls =
    tone === "primary"
      ? "bg-cell-ink text-white hover:bg-cell-ink-deep"
      : "border border-border-subtle text-ink-body hover:border-cell-coral hover:text-cell-coral-text";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded px-4 py-2 font-ui text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${cls}`}
    >
      {pending ? busy : label}
    </button>
  );
}

export function AccountRequestCard({ request }: { request: PendingRequest }) {
  const [approveState, approve] = useActionState(approveAccountRequest, initial);
  const [declineState, decline] = useActionState(declineAccountRequest, initial);
  const [showDecline, setShowDecline] = useState(false);
  const [copied, setCopied] = useState(false);

  const state = approveState.message ? approveState : declineState;
  const done = approveState.ok || declineState.ok;

  return (
    <li className="rounded-lg border border-border-subtle bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-bold text-ink-strong">
            {request.full_name}
          </h3>
          <p className="mt-1 font-ui text-sm break-all text-ink-body">{request.email}</p>
          <p className="mt-1 font-ui text-xs text-ink-muted">
            Class {request.class_section} · Joined {request.year_joined} · Applied{" "}
            {new Date(request.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        {!done && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <form action={approve}>
              <input type="hidden" name="request_id" value={request.id} />
              <Submit label="Approve" busy="Approving…" tone="primary" />
            </form>
            <button
              type="button"
              onClick={() => setShowDecline((v) => !v)}
              aria-expanded={showDecline}
              className="rounded border border-border-subtle px-4 py-2 font-ui text-sm font-semibold text-ink-body transition-colors hover:border-cell-coral hover:text-cell-coral-text"
            >
              Decline
            </button>
          </div>
        )}
      </div>

      {showDecline && !done && (
        <form action={decline} className="mt-4 border-t border-border-subtle pt-4">
          <input type="hidden" name="request_id" value={request.id} />
          <label
            htmlFor={`note-${request.id}`}
            className="block font-ui text-sm font-medium text-ink-strong"
          >
            Reason (optional, kept on the permanent record)
          </label>
          <textarea
            id={`note-${request.id}`}
            name="review_note"
            rows={2}
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm text-ink-strong"
          />
          <div className="mt-3">
            <Submit label="Confirm decline" busy="Recording…" tone="quiet" />
          </div>
        </form>
      )}

      {state.message && (
        <p
          role="status"
          className={`mt-4 rounded px-3 py-2.5 font-ui text-sm ${
            state.ok
              ? "border border-lgs-200 bg-lgs-50 text-ink-strong"
              : "border border-cell-coral/40 bg-cell-coral/5 text-ink-strong"
          }`}
        >
          {state.message}
        </p>
      )}

      {/* Shown only until a mail provider is configured. The student needs this
          link to choose a password; approval itself is already recorded in the
          database and does not depend on the link being delivered. */}
      {approveState.inviteLink && (
        <div className="mt-3 rounded border border-lgs-200 bg-lgs-50 p-4">
          <h4 className="font-ui text-sm font-semibold text-ink-strong">
            Send this link to the student
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-body">
            No email provider is configured yet, so the invitation was not sent
            automatically. The student uses this link once, to choose a password.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded border border-border-subtle bg-surface px-3 py-2 font-mono text-xs text-ink-body">
              {approveState.inviteLink}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(approveState.inviteLink!);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="rounded border border-lgs-500 px-3 py-2 font-ui text-sm font-medium text-lgs-600"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
