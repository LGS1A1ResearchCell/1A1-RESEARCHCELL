"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  addResearchAuthor,
  removeResearchAuthor,
  setResearchStatus,
  updateResearch,
  uploadResearchPdf,
  type ResearchFormState,
} from "@/lib/research/actions";

const initial: ResearchFormState = { ok: false };

function Notice({ state }: { state: ResearchFormState }) {
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
  tone?: "primary" | "quiet";
}) {
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

const field =
  "mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong";
const labelClass = "block font-ui text-sm font-medium text-ink-strong";

export type ResearchRecord = {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  abstract: string | null;
  research_area: string | null;
  supervisor: string | null;
  references_text: string | null;
  academic_year_id: string | null;
  subject_id: string | null;
  pdf_path: string | null;
  pdf_filename: string | null;
};

export type AuthorRow = { id: string; full_name: string };
export type Option = { id: string; label: string };

export function ResearchEditor({
  record,
  authors,
  years,
  subjects,
}: {
  record: ResearchRecord;
  authors: AuthorRow[];
  years: Option[];
  subjects: Option[];
}) {
  const [saveState, save] = useActionState(updateResearch, initial);
  const [statusState, changeStatus] = useActionState(setResearchStatus, initial);
  const [pdfState, uploadPdf] = useActionState(uploadResearchPdf, initial);
  const [authorState, addAuthor] = useActionState(addResearchAuthor, initial);
  const [removeState, removeAuthor] = useActionState(removeResearchAuthor, initial);

  const published = record.status === "published";
  const err = saveState.fieldErrors ?? {};

  return (
    <div className="mt-8 space-y-8">
      {/* ---------------------------------------------------------------- */}
      {/* Publication state                                                 */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-labelledby="state"
        className={`rounded-lg border p-5 ${
          published
            ? "border-lgs-200 bg-lgs-50"
            : "border-border-subtle bg-surface"
        }`}
      >
        <h2 id="state" className="font-ui text-sm font-semibold text-ink-strong">
          {published ? "Published" : "Draft"}
        </h2>
        <p className="mt-1.5 max-w-prose text-sm text-ink-body">
          {published
            ? "This paper is on the public Research page and has its own public page."
            : "Nothing here is visible to the public. Publish it when it is ready."}
        </p>

        <form action={changeStatus} className="mt-4">
          <input type="hidden" name="research_id" value={record.id} />
          <input type="hidden" name="status" value={published ? "draft" : "published"} />
          <Busy
            label={published ? "Move back to drafts" : "Publish"}
            busy={published ? "Moving…" : "Publishing…"}
            tone={published ? "quiet" : "primary"}
          />
        </form>
        <Notice state={statusState} />
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The paper                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="details" className="rounded-lg border border-border-subtle bg-surface p-5">
        <h2 id="details" className="font-heading text-lg font-bold text-ink-strong">
          The paper
        </h2>

        <form action={save} className="mt-4">
          <input type="hidden" name="research_id" value={record.id} />

          <div>
            <label htmlFor="title" className={labelClass}>
              Title
            </label>
            <input
              id="title"
              name="title"
              defaultValue={record.title}
              required
              aria-invalid={err.title ? true : undefined}
              aria-describedby={err.title ? "title-error" : undefined}
              className={field}
            />
            {err.title && (
              <p id="title-error" className="mt-1 font-ui text-xs text-cell-coral-text">
                {err.title}
              </p>
            )}
          </div>

          <div className="mt-4">
            <label htmlFor="abstract" className={labelClass}>
              Abstract
            </label>
            <textarea
              id="abstract"
              name="abstract"
              rows={5}
              defaultValue={record.abstract ?? ""}
              className={field}
            />
            <p className="mt-1 font-ui text-xs text-ink-muted">
              Leave empty if the paper has none. Nothing is invented for it.
            </p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="research_area" className={labelClass}>
                Research area
              </label>
              <input
                id="research_area"
                name="research_area"
                defaultValue={record.research_area ?? ""}
                className={field}
              />
            </div>
            <div>
              <label htmlFor="supervisor" className={labelClass}>
                Supervisor
              </label>
              <input
                id="supervisor"
                name="supervisor"
                defaultValue={record.supervisor ?? ""}
                className={field}
              />
            </div>
            <div>
              <label htmlFor="academic_year_id" className={labelClass}>
                Academic year
              </label>
              <select
                id="academic_year_id"
                name="academic_year_id"
                defaultValue={record.academic_year_id ?? ""}
                className={field}
              >
                <option value="">Not set</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="subject_id" className={labelClass}>
                Subject
              </label>
              <select
                id="subject_id"
                name="subject_id"
                defaultValue={record.subject_id ?? ""}
                className={field}
              >
                <option value="">Not set</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="references_text" className={labelClass}>
              References
            </label>
            <textarea
              id="references_text"
              name="references_text"
              rows={6}
              defaultValue={record.references_text ?? ""}
              className={field}
            />
            <p className="mt-1 font-ui text-xs text-ink-muted">
              One per line, as the authors wrote them.
            </p>
          </div>

          <div className="mt-5">
            <Busy label="Save changes" busy="Saving…" />
          </div>
          <Notice state={saveState} />
        </form>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Authors                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="authors" className="rounded-lg border border-border-subtle bg-surface p-5">
        <h2 id="authors" className="font-heading text-lg font-bold text-ink-strong">
          Authors
        </h2>
        <p className="mt-1.5 max-w-prose text-sm text-ink-body">
          Authors are records on the paper. Nobody needs an account to be one,
          and adding someone here does not put them on the public People page.
        </p>

        {authors.length > 0 ? (
          <ul className="mt-4 divide-y divide-border-subtle rounded border border-border-subtle">
            {authors.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="font-ui text-sm text-ink-strong">{a.full_name}</span>
                <form action={removeAuthor}>
                  <input type="hidden" name="research_id" value={record.id} />
                  <input type="hidden" name="author_id" value={a.id} />
                  <button
                    type="submit"
                    className="rounded border border-border-subtle px-2.5 py-1 font-ui text-xs text-ink-body transition-colors hover:border-cell-coral hover:text-cell-coral-text"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded border border-dashed border-border-subtle p-5 text-center text-sm text-ink-muted">
            No authors recorded yet.
          </p>
        )}
        <Notice state={removeState} />

        <form action={addAuthor} className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
          <input type="hidden" name="research_id" value={record.id} />
          <div>
            <label htmlFor="full_name" className={labelClass}>
              Add an author
            </label>
            <input id="full_name" name="full_name" required className={field} />
          </div>
          <div>
            <label htmlFor="kind" className="block font-ui text-xs text-ink-muted">
              They are a
            </label>
            <select id="kind" name="kind" defaultValue="student" className={field}>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="external">External</option>
            </select>
          </div>
          <div className="pb-0.5">
            <Busy label="Add" busy="Adding…" tone="quiet" />
          </div>
        </form>
        <Notice state={authorState} />
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* PDF                                                               */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="pdf" className="rounded-lg border border-border-subtle bg-surface p-5">
        <h2 id="pdf" className="font-heading text-lg font-bold text-ink-strong">
          PDF
        </h2>
        <p className="mt-1.5 max-w-prose text-sm text-ink-body">
          PDF is the only accepted format. Uploading a new one replaces what is
          shown on the public page.
        </p>

        {record.pdf_filename && (
          <p className="mt-3 rounded border border-border-subtle bg-surface-muted px-3 py-2 font-ui text-sm text-ink-body">
            Currently attached: <span className="font-semibold">{record.pdf_filename}</span>
          </p>
        )}

        <form action={uploadPdf} className="mt-4">
          <input type="hidden" name="research_id" value={record.id} />
          <label htmlFor="pdf" className={labelClass}>
            {record.pdf_filename ? "Replace the PDF" : "Upload the PDF"}
          </label>
          <input
            id="pdf"
            name="pdf"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="mt-1.5 block w-full font-ui text-sm text-ink-body file:mr-4 file:rounded file:border-0 file:bg-cell-ink file:px-4 file:py-2 file:font-ui file:text-sm file:font-semibold file:text-white"
          />
          <div className="mt-4">
            <Busy label="Upload" busy="Uploading…" tone="quiet" />
          </div>
          <Notice state={pdfState} />
        </form>
      </section>
    </div>
  );
}
