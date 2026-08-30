import Link from "next/link";

import { StatusBadge } from "@/components/research/StatusBadge";
import { requireLeadership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Review research" };

type QueueRow = {
  id: string;
  title: string;
  status: string;
  meta: string;
  /** True when the viewer is an author, and so cannot decide this submission. */
  barred: boolean;
};

/**
 * One band of the queue.
 *
 * Defined at module scope rather than inside the page: a component created
 * during render is a new component type each time, which remounts its subtree
 * and discards its state.
 */
function QueueSection({
  id,
  title,
  blurb,
  rows,
  empty,
}: {
  id: string;
  title: string;
  blurb: string;
  rows: QueueRow[];
  empty: string;
}) {
  return (
    <section className="mt-12" aria-labelledby={id}>
      <h2 id={id} className="font-heading text-xl font-bold text-ink-strong">
        {title}{" "}
        <span className="font-ui text-base font-normal text-ink-muted">
          ({rows.length})
        </span>
      </h2>
      <p className="mt-1.5 max-w-prose text-sm text-ink-body">{blurb}</p>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border-subtle bg-surface p-6 text-center text-sm text-ink-muted">
          {empty}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
          {rows.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/review/${p.id}`}
                className="block p-4 transition-colors hover:bg-lgs-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-heading text-base font-bold text-ink-strong">
                      {p.title}
                    </h3>
                    <p className="mt-1 font-ui text-xs text-ink-muted">{p.meta}</p>
                    {p.barred && (
                      <p className="mt-1.5 font-ui text-xs font-medium text-cell-coral">
                        You are an author &mdash; someone else must review this
                      </p>
                    )}
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The review queue.
 *
 * Leadership can read every project through research_projects_leadership_read,
 * so the grouping here is about what a reviewer needs to see next, not about
 * what they are permitted to see.
 */
export default async function ReviewQueuePage() {
  const ctx = await requireLeadership();
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("research_projects")
    .select(
      "id, title, status, research_type, authorship_mode, team_name, submitted_at, research_authors(person_id, people(full_name))",
    )
    .in("status", ["submitted", "under_review", "revision_required", "approved"])
    .order("submitted_at", { ascending: true, nullsFirst: false });

  const all = projects ?? [];
  type Row = (typeof all)[number];

  const prepare = (rows: Row[]): QueueRow[] =>
    rows.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      meta: [
        p.research_type === "primary"
          ? "Primary"
          : p.research_type === "secondary"
            ? "Secondary"
            : "Independent",
        p.authorship_mode === "team" ? "Team" : "Individual",
        p.team_name,
        (p.research_authors ?? [])
          .map((a) => (a.people as unknown as { full_name: string } | null)?.full_name)
          .filter(Boolean)
          .join(", "),
      ]
        .filter(Boolean)
        .join(" · "),
      // Nobody decides their own work; the database refuses it too.
      barred: (p.research_authors ?? []).some(
        (a: { person_id: string }) => a.person_id === ctx.personId,
      ),
    }));

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
          Review research
        </h1>
        <p className="mt-2 max-w-prose text-ink-body">
          Submissions from Research Cell members. A review is either a request
          for revision or an approval &mdash; there is no rejection.
        </p>
      </header>

      <div className="rule-notebook mt-10 pt-2" />

      <QueueSection
        id="awaiting"
        title="Awaiting your review"
        blurb="Submitted by the authors and ready to be read."
        rows={prepare(all.filter((p) => ["submitted", "under_review"].includes(p.status)))}
        empty="Nothing is waiting to be reviewed."
      />

      <QueueSection
        id="with-authors"
        title="With the authors"
        blurb="A revision has been requested. These return here once resubmitted."
        rows={prepare(all.filter((p) => p.status === "revision_required"))}
        empty="No submissions are currently with their authors."
      />

      <QueueSection
        id="approved"
        title="Approved"
        blurb="Eligible for inclusion in a journal. Can be reopened for revision if a correction is needed before publication."
        rows={prepare(all.filter((p) => p.status === "approved"))}
        empty="No approved research yet."
      />
    </>
  );
}
