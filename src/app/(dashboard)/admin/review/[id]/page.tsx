import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/research/StatusBadge";
import { ReviewHistory, type ReviewEntry } from "@/components/review/ReviewHistory";
import { ReopenPanel, ReviewPanel } from "@/components/review/ReviewPanel";
import { requireLeadership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Review submission" };

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireLeadership();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("research_projects")
    .select(
      "id, title, status, research_type, authorship_mode, team_name, research_area, abstract, submitted_at, subjects(name), academic_years(label)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const [{ data: authors }, { data: versions }, { data: history }] = await Promise.all([
    supabase
      .from("research_authors")
      .select("person_id, author_role, author_order, confirmation_status, people(full_name)")
      .eq("project_id", id)
      .order("author_order"),
    supabase
      .from("research_versions")
      .select("id, version_number, document_filename, submitted_at, notes")
      .eq("project_id", id)
      .order("version_number", { ascending: false }),
    supabase
      .from("research_review_history")
      .select("review_id, version_number, document_filename, decision, feedback, reviewed_at, reviewer_name")
      .eq("project_id", id),
  ]);

  const versionList = versions ?? [];
  const latest = versionList[0];
  const reviewed = new Set((history ?? []).map((h) => h.version_number));
  const latestReviewed = latest ? reviewed.has(latest.version_number) : false;

  // Barred from deciding their own work. The database refuses it too; showing
  // it here means a reviewer is told why rather than meeting an error.
  const iAmAuthor = (authors ?? []).some(
    (a: { person_id: string }) => a.person_id === ctx.personId,
  );

  const openForReview = ["submitted", "under_review"].includes(project.status);

  return (
    <>
      <header>
        <p className="font-ui text-sm text-ink-muted">
          <Link href="/admin/review" className="text-lgs-600 underline">
            Review research
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
            project.research_type === "primary" ? "Primary Research" :
            project.research_type === "secondary" ? "Secondary Research" : "Independent Research",
            project.authorship_mode === "team" ? "Team research" : "Individual research",
            project.team_name,
            (project.subjects as unknown as { name: string } | null)?.name,
            project.research_area,
            (project.academic_years as unknown as { label: string } | null)?.label,
          ].filter(Boolean).join(" · ")}
        </p>
      </header>

      <section className="rule-notebook mt-10 pt-8">
        <h2 className="font-heading text-lg font-bold text-ink-strong">Authors</h2>
        <ul className="mt-3 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
          {(authors ?? []).map((a) => (
            <li key={a.person_id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
              <span className="font-ui text-sm text-ink-strong">
                <span className="font-semibold">
                  {(a.people as unknown as { full_name: string } | null)?.full_name}
                </span>
                <span className="text-ink-muted">
                  {" — "}
                  {a.author_role === "team_leader" ? "Team Leader"
                    : a.author_role === "sole_author" ? "Sole author" : "Co-author"}
                </span>
              </span>
              <span className="shrink-0 font-ui text-xs text-ink-muted">
                {a.confirmation_status === "confirmed" ? "Confirmed" : a.confirmation_status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {project.abstract && (
        <section className="mt-10 max-w-prose">
          <h2 className="font-heading text-lg font-bold text-ink-strong">Abstract</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-body">{project.abstract}</p>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-heading text-lg font-bold text-ink-strong">
          Submitted documents{" "}
          <span className="font-ui text-sm font-normal text-ink-muted">
            ({versionList.length})
          </span>
        </h2>
        <p className="mt-1.5 text-sm text-ink-body">
          Every version is kept. Nothing an author has submitted is ever
          replaced.
        </p>
        <ul className="mt-4 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
          {versionList.map((v) => (
            <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-3 p-3.5">
              <span className="min-w-0">
                <span className="font-ui text-sm font-semibold text-ink-strong">
                  Version {v.version_number}
                </span>
                <span className="ml-2 font-ui text-xs break-all text-ink-muted">
                  {v.document_filename}
                </span>
                {v.notes && (
                  <span className="mt-1 block text-sm text-ink-body italic">{v.notes}</span>
                )}
              </span>
              <span className="shrink-0 font-ui text-xs text-ink-muted">
                {reviewed.has(v.version_number) ? "Reviewed" : "Not yet reviewed"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The decision                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-12">
        {project.status === "approved" ? (
          <ReopenPanel projectId={id} />
        ) : openForReview && latest && !latestReviewed ? (
          <ReviewPanel
            versionId={latest.id}
            versionNumber={latest.version_number}
            authorIsReviewer={iAmAuthor}
          />
        ) : (
          <div className="rounded-lg border border-border-subtle bg-surface p-5">
            <h2 className="font-heading text-lg font-bold text-ink-strong">
              No decision needed right now
            </h2>
            <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-body">
              {project.status === "revision_required"
                ? "A revision has been requested. This returns for review once the authors submit a new version."
                : latestReviewed
                  ? "The latest version has already been reviewed. A further decision needs a new version from the authors."
                  : "This submission is not currently open for review."}
            </p>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-lg font-bold text-ink-strong">Review history</h2>
        <div className="mt-4">
          <ReviewHistory entries={(history ?? []) as ReviewEntry[]} />
        </div>
      </section>
    </>
  );
}
