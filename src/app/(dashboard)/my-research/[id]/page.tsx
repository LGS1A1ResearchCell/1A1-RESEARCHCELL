import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AdvanceControls,
  AuthorManager,
  ConfirmAuthorship,
  DocumentUpload,
  type Author,
} from "@/components/research/ProjectWorkspace";
import { ReviewHistory, type ReviewEntry } from "@/components/review/ReviewHistory";
import { StatusBadge } from "@/components/research/StatusBadge";
import { requireActiveAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Submission" };

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireActiveAccount();
  const supabase = await createClient();

  // Row Level Security decides whether this row is visible at all: a project
  // the caller does not author simply comes back empty, and they get a 404.
  const { data: project } = await supabase
    .from("research_projects")
    .select(
      "id, title, status, research_type, authorship_mode, team_name, research_area, abstract, subjects(name), academic_years(label)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const [{ data: authorRows }, { data: versions }, { data: changes }] =
    await Promise.all([
      supabase
        .from("research_authors")
        .select(
          "person_id, author_role, author_order, confirmation_status, confirmed_at, people(full_name)",
        )
        .eq("project_id", id)
        .order("author_order"),
      supabase
        .from("research_versions")
        .select(
          "id, version_number, document_filename, document_size_bytes, submitted_at, notes",
        )
        .eq("project_id", id)
        .order("version_number", { ascending: false }),
      supabase
        .from("research_authorship_changes")
        .select("change, created_at, people(full_name)")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
    ]);

  // Reviewer feedback, visible to the authors of this work only. The rows come
  // from the review-history view, whose visibility is governed by RLS on
  // reviews -- this page does no filtering of its own.
  const { data: reviews } = await supabase
    .from("research_review_history")
    .select("review_id, version_number, document_filename, decision, feedback, reviewed_at, reviewer_name")
    .eq("project_id", id);

  const authors: Author[] = (authorRows ?? []).map((a) => ({
    person_id: a.person_id,
    author_role: a.author_role,
    author_order: a.author_order,
    confirmation_status: a.confirmation_status,
    confirmed_at: a.confirmed_at,
    full_name:
      (a.people as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
  }));

  const mine = authors.find((a) => a.person_id === ctx.personId);
  const isLead =
    mine?.author_role === "team_leader" || mine?.author_role === "sole_author";
  const isTeam = project.authorship_mode === "team";
  const unconfirmed = authors.filter(
    (a) => a.confirmation_status !== "confirmed",
  ).length;

  // The list closes once a co-author has confirmed. The leader's own automatic
  // confirmation does not count, or no team could ever be assembled.
  const frozen = authors.some(
    (a) => a.author_role === "co_author" && a.confirmation_status === "confirmed",
  );

  const editable =
    project.status === "draft" ||
    project.status === "awaiting_author_confirmation" ||
    project.status === "revision_required";
  const needsMyConfirmation = mine?.confirmation_status === "pending";

  const typeLabel =
    project.research_type === "primary"
      ? "Primary Research"
      : project.research_type === "secondary"
        ? "Secondary Research"
        : "Independent Research";

  return (
    <>
      <header>
        <p className="font-ui text-sm text-ink-muted">
          <Link href="/my-research" className="text-lgs-600 underline">
            My research
          </Link>
          {" / "}Submission
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-heading text-2xl font-extrabold text-ink-strong sm:text-3xl">
            {project.title}
          </h1>
          <StatusBadge status={project.status} />
        </div>
        <p className="mt-2 font-ui text-sm text-ink-muted">
          {[
            typeLabel,
            isTeam ? "Team research" : "Individual research",
            project.team_name,
            (project.subjects as unknown as { name: string } | null)?.name,
            project.research_area,
            (project.academic_years as unknown as { label: string } | null)?.label,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {needsMyConfirmation && (
        <div className="mt-8">
          <ConfirmAuthorship projectId={id} />
        </div>
      )}

      {project.abstract && (
        <section className="rule-notebook mt-10 max-w-prose pt-8">
          <h2 className="font-heading text-lg font-bold text-ink-strong">Abstract</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-body">
            {project.abstract}
          </p>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Authors                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-12">
        <h2 className="font-heading text-lg font-bold text-ink-strong">
          Authors{" "}
          <span className="font-ui text-sm font-normal text-ink-muted">
            ({authors.length})
          </span>
        </h2>

        {isLead && isTeam && editable ? (
          <div className="mt-4">
            <AuthorManager projectId={id} authors={authors} frozen={frozen} />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
            {authors.map((a) => (
              <li
                key={a.person_id}
                className="flex flex-wrap items-center justify-between gap-3 p-3.5"
              >
                <span className="min-w-0">
                  <span className="block font-ui text-sm font-semibold text-ink-strong">
                    {a.full_name}
                  </span>
                  <span className="block font-ui text-xs text-ink-muted">
                    {a.author_role === "team_leader"
                      ? "Team Leader"
                      : a.author_role === "sole_author"
                        ? "Sole author"
                        : "Co-author"}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 font-ui text-xs font-medium ${
                    a.confirmation_status === "confirmed"
                      ? "bg-lgs-100 text-lgs-700"
                      : a.confirmation_status === "declined"
                        ? "bg-cell-coral/10 text-cell-coral-text"
                        : "bg-surface-sunken text-ink-muted"
                  }`}
                >
                  {a.confirmation_status === "confirmed"
                    ? "Confirmed"
                    : a.confirmation_status === "declined"
                      ? "Declined"
                      : "Awaiting confirmation"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Reviewer feedback                                                 */}
      {/* ---------------------------------------------------------------- */}
      {(reviews ?? []).length > 0 && (
        <section className="mt-12">
          <h2 className="font-heading text-lg font-bold text-ink-strong">
            Reviewer feedback
          </h2>
          <p className="mt-1.5 max-w-prose text-sm text-ink-body">
            {project.status === "revision_required"
              ? "The Research Cell has asked for changes. Address the feedback below, then upload a new version and resubmit."
              : "The permanent record of every decision on this submission."}
          </p>
          <div className="mt-4">
            <ReviewHistory entries={(reviews ?? []) as ReviewEntry[]} />
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Versions                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-12">
        <h2 className="font-heading text-lg font-bold text-ink-strong">
          Document versions{" "}
          <span className="font-ui text-sm font-normal text-ink-muted">
            ({(versions ?? []).length})
          </span>
        </h2>

        {(versions ?? []).length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border-subtle bg-surface p-6 text-center text-sm text-ink-muted">
            No document uploaded yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
            {(versions ?? []).map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-baseline justify-between gap-3 p-3.5"
              >
                <span className="min-w-0">
                  <span className="font-ui text-sm font-semibold text-ink-strong">
                    Version {v.version_number}
                  </span>
                  <span className="ml-2 font-ui text-xs break-all text-ink-muted">
                    {v.document_filename}
                  </span>
                  {v.notes && (
                    <span className="mt-1 block text-sm text-ink-body italic">
                      {v.notes}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-ui text-xs text-ink-muted">
                  {new Date(v.submitted_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}

        {isLead && editable && (
          <div className="mt-5 rounded-lg border border-border-subtle bg-surface p-5">
            <DocumentUpload projectId={id} />
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Advance                                                           */}
      {/* ---------------------------------------------------------------- */}
      {isLead && editable && (
        <section className="mt-12 rounded-lg border border-border-subtle bg-surface p-5">
          <h2 className="font-heading text-lg font-bold text-ink-strong">
            {project.status === "draft" ? "Ready to go?" : "Next step"}
          </h2>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-body">
            {isTeam && project.status === "draft"
              ? "Once you send this to your authors, each of them confirms their own authorship. It can go to review when all have."
              : "Submitting sends this to the Research Cell for review."}
          </p>
          <div className="mt-4">
            <AdvanceControls
              projectId={id}
              status={project.status}
              isTeam={isTeam}
              unconfirmed={unconfirmed}
              hasDocument={(versions ?? []).length > 0}
            />
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Authorship history                                                */}
      {/* ---------------------------------------------------------------- */}
      {(changes ?? []).length > 0 && (
        <section className="mt-12">
          <h2 className="font-heading text-lg font-bold text-ink-strong">
            Authorship history
          </h2>
          <p className="mt-1.5 text-sm text-ink-body">
            Every addition and removal is permanently recorded.
          </p>
          <ul className="mt-4 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
            {(changes ?? []).map((c, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2.5"
              >
                <span className="font-ui text-sm text-ink-strong">
                  {(c.people as unknown as { full_name: string } | null)?.full_name}{" "}
                  <span className="text-ink-muted">
                    {c.change === "added" ? "added" : "removed"}
                  </span>
                </span>
                <span className="font-ui text-xs text-ink-muted">
                  {new Date(c.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
