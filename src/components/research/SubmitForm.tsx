"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createResearchProject,
  type ResearchFormState,
} from "@/lib/research/actions";

const initial: ResearchFormState = { ok: false };

const RESEARCH_TYPES = [
  { value: "primary", label: "Primary Research", hint: "You gathered your own data." },
  { value: "secondary", label: "Secondary Research", hint: "You worked from existing research." },
  { value: "independent", label: "Independent Research", hint: "Your own paper, outside a team project." },
] as const;

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-cell-ink px-5 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Creating…" : label}
    </button>
  );
}

/**
 * Two steps: fill in, then review before anything is created.
 *
 * The review screen is not decoration. Research type and individual-versus-team
 * are effectively permanent once co-authors start confirming, so the student
 * sees exactly what they are about to create before it exists.
 */
export function SubmitForm({
  subjects,
}: {
  subjects: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(createResearchProject, initial);
  const [reviewing, setReviewing] = useState(false);
  const [values, setValues] = useState({
    title: "",
    research_type: "",
    authorship_mode: "",
    subject_id: "",
    research_area: "",
    abstract: "",
    team_name: "",
  });

  const err = state.fieldErrors ?? {};
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const canReview =
    values.title.trim().length >= 5 &&
    values.research_type !== "" &&
    values.authorship_mode !== "";

  const subjectName = subjects.find((s) => s.id === values.subject_id)?.name;

  if (reviewing) {
    return (
      <form action={action} className="space-y-6">
        {Object.entries(values).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}

        <div className="rounded-lg border border-lgs-200 bg-lgs-50 p-5">
          <h2 className="font-heading text-lg font-bold text-ink-strong">
            Check this before you continue
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-body">
            {values.authorship_mode === "team"
              ? "You are creating a team submission. You will be its Team Leader: you add the other authors, upload the paper and manage the submission. Every author must confirm before it can go to review."
              : "You are creating an individual submission. You will be its sole author."}
          </p>
        </div>

        <dl className="grid grid-cols-[10rem_1fr] gap-x-6 gap-y-3 rounded-lg border border-border-subtle bg-surface p-5">
          <dt className="font-ui text-sm text-ink-muted">Title</dt>
          <dd className="font-ui text-sm font-semibold text-ink-strong">{values.title}</dd>

          <dt className="font-ui text-sm text-ink-muted">Research type</dt>
          <dd className="font-ui text-sm text-ink-strong">
            {RESEARCH_TYPES.find((t) => t.value === values.research_type)?.label}
          </dd>

          <dt className="font-ui text-sm text-ink-muted">Authorship</dt>
          <dd className="font-ui text-sm text-ink-strong">
            {values.authorship_mode === "team" ? "Team research" : "Individual research"}
          </dd>

          {values.authorship_mode === "team" && values.team_name && (
            <>
              <dt className="font-ui text-sm text-ink-muted">Team name</dt>
              <dd className="font-ui text-sm text-ink-strong">{values.team_name}</dd>
            </>
          )}

          <dt className="font-ui text-sm text-ink-muted">Subject</dt>
          <dd className="font-ui text-sm text-ink-strong">{subjectName ?? "—"}</dd>

          <dt className="font-ui text-sm text-ink-muted">Research area</dt>
          <dd className="font-ui text-sm text-ink-strong">{values.research_area || "—"}</dd>

          <dt className="font-ui text-sm text-ink-muted">Abstract</dt>
          <dd className="text-sm leading-relaxed text-ink-body">
            {values.abstract || <span className="text-ink-muted">Not provided</span>}
          </dd>
        </dl>

        {state.message && (
          <p role="alert" className="rounded border border-cell-coral/40 bg-cell-coral/5 px-3 py-2.5 font-ui text-sm text-ink-strong">
            {state.message}
          </p>
        )}

        <p className="font-ui text-xs text-ink-muted">
          This creates a draft. Nothing is sent for review until you upload your
          paper and submit it.
        </p>

        <div className="flex flex-wrap gap-3">
          <Submit label="Create draft" />
          <button
            type="button"
            onClick={() => setReviewing(false)}
            className="rounded border border-border-subtle px-5 py-2.5 font-ui text-sm font-semibold text-ink-body transition-colors hover:border-lgs-500 hover:text-lgs-600"
          >
            Go back and edit
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="title" className="block font-ui text-sm font-medium text-ink-strong">
          Research title
        </label>
        <input
          id="title" value={values.title} onChange={set("title")}
          className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
        />
        {err.title && <p className="mt-1 font-ui text-xs text-cell-coral">{err.title}</p>}
      </div>

      <fieldset>
        <legend className="font-ui text-sm font-medium text-ink-strong">Research type</legend>
        <div className="mt-2 space-y-2">
          {RESEARCH_TYPES.map((t) => (
            <label key={t.value} className="flex cursor-pointer gap-3 rounded border border-border-subtle bg-surface p-3">
              <input
                type="radio" name="research_type_ui" value={t.value}
                checked={values.research_type === t.value}
                onChange={set("research_type")}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>
                <span className="block font-ui text-sm font-semibold text-ink-strong">{t.label}</span>
                <span className="block font-ui text-xs text-ink-muted">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-ui text-sm font-medium text-ink-strong">
          Individual or team research
        </legend>
        <p className="mt-1 font-ui text-xs text-ink-muted">
          These are separate from the research type above.
        </p>
        <div className="mt-2 space-y-2">
          {[
            { value: "individual", label: "Individual research", hint: "You are the only author." },
            { value: "team", label: "Team research", hint: "You become Team Leader and add the other authors." },
          ].map((m) => (
            <label key={m.value} className="flex cursor-pointer gap-3 rounded border border-border-subtle bg-surface p-3">
              <input
                type="radio" name="authorship_mode_ui" value={m.value}
                checked={values.authorship_mode === m.value}
                onChange={set("authorship_mode")}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>
                <span className="block font-ui text-sm font-semibold text-ink-strong">{m.label}</span>
                <span className="block font-ui text-xs text-ink-muted">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {values.authorship_mode === "team" && (
        <div>
          <label htmlFor="team_name" className="block font-ui text-sm font-medium text-ink-strong">
            Team name <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id="team_name" value={values.team_name} onChange={set("team_name")}
            placeholder="LGS 1A1 Secondary Research Team - A2"
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
          />
          <p className="mt-1 font-ui text-xs text-ink-muted">
            Printed alongside your paper if it is published, as in Journal I.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="subject_id" className="block font-ui text-sm font-medium text-ink-strong">
            Subject <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <select
            id="subject_id" value={values.subject_id} onChange={set("subject_id")}
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
          >
            <option value="">Not specified</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="research_area" className="block font-ui text-sm font-medium text-ink-strong">
            Research area <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id="research_area" value={values.research_area} onChange={set("research_area")}
            placeholder="Cognitive Biology and Restorative Science"
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
          />
        </div>
      </div>

      <div>
        <label htmlFor="abstract" className="block font-ui text-sm font-medium text-ink-strong">
          Abstract <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <textarea
          id="abstract" rows={5} value={values.abstract} onChange={set("abstract")}
          className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
        />
        <p className="mt-1 font-ui text-xs text-ink-muted">
          You can add or change this later, before submitting.
        </p>
      </div>

      <button
        type="button"
        disabled={!canReview}
        onClick={() => setReviewing(true)}
        className="rounded bg-cell-ink px-5 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        Review before creating
      </button>
    </div>
  );
}
