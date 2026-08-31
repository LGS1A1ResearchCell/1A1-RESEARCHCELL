import Link from "next/link";

import { StatusBadge } from "@/components/research/StatusBadge";
import { requireActiveAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My research" };

export default async function MyResearchPage() {
  const ctx = await requireActiveAccount();
  const supabase = await createClient();

  // Scope this list explicitly to the caller's own work.
  //
  // Leaning on Row Level Security here would be wrong, and was: RLS decides
  // what a user is ALLOWED to read, not what a page should show. Published
  // research is readable by everyone, so an unfiltered query returned the whole
  // public archive and listed all six Journal I papers as this student's own.
  const { data: authored } = await supabase
    .from("research_authors")
    .select("project_id")
    .eq("person_id", ctx.personId!);

  const authoredIds = (authored ?? []).map((r) => r.project_id);

  let query = supabase
    .from("research_projects")
    .select(
      "id, title, status, research_type, authorship_mode, team_name, updated_at, research_authors(person_id, author_role, confirmation_status)",
    )
    .order("updated_at", { ascending: false });

  // Anything they created is included too, so a submission is never orphaned
  // from its owner's view if an authorship row were ever missing.
  query =
    authoredIds.length > 0
      ? query.or(`id.in.(${authoredIds.join(",")}),created_by.eq.${ctx.userId}`)
      : query.eq("created_by", ctx.userId);

  const { data: projects } = await query;
  const list = projects ?? [];
  const awaitingMe = list.filter((p) =>
    (p.research_authors ?? []).some(
      (a: { person_id: string; confirmation_status: string }) =>
        a.person_id === ctx.personId && a.confirmation_status === "pending",
    ),
  );

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
            My research
          </h1>
          <p className="mt-2 text-ink-body">
            Everything you have written or been named on.
          </p>
        </div>
        <Link
          href="/my-research/new"
          className="rounded bg-cell-ink px-4 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep"
        >
          Submit research
        </Link>
      </header>

      {awaitingMe.length > 0 && (
        <section className="mt-8 rounded-lg border border-cell-coral/40 bg-cell-coral/5 p-5">
          <h2 className="font-heading text-lg font-bold text-ink-strong">
            {awaitingMe.length} submission{awaitingMe.length === 1 ? "" : "s"} need your confirmation
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-body">
            You have been named as an author. These cannot go to review until you
            confirm.
          </p>
          <ul className="mt-3 space-y-1.5">
            {awaitingMe.map((p) => (
              <li key={p.id}>
                <Link href={`/my-research/${p.id}`} className="font-ui text-sm font-semibold text-lgs-600 underline">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Named so the list is a labelled region, and so the paper titles below
          sit at h3 under a real h2 rather than jumping straight from the h1 —
          the confirmation section above it is conditional and cannot carry
          that level on its own. */}
      <section aria-labelledby="submissions" className="rule-notebook mt-10 pt-8">
        <h2 id="submissions" className="font-heading text-lg font-bold text-ink-strong">
          Your submissions
        </h2>
        {list.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border-subtle bg-surface p-10 text-center text-sm text-ink-muted">
            You have not submitted any research yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
            {list.map((p) => {
              const mine = (p.research_authors ?? []).find(
                (a: { person_id: string }) => a.person_id === ctx.personId,
              ) as { author_role?: string } | undefined;
              return (
                <li key={p.id}>
                  <Link href={`/my-research/${p.id}`} className="block p-4 transition-colors hover:bg-lgs-50">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-heading text-base font-bold text-ink-strong">
                          {p.title}
                        </h3>
                        <p className="mt-1 font-ui text-xs text-ink-muted">
                          {[
                            p.research_type === "primary" ? "Primary" : p.research_type === "secondary" ? "Secondary" : "Independent",
                            p.authorship_mode === "team" ? "Team" : "Individual",
                            mine?.author_role === "team_leader" ? "You are Team Leader" : mine?.author_role === "sole_author" ? "Sole author" : "Co-author",
                            p.team_name,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
