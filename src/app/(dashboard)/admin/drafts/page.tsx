import { ResearchList, type ResearchRow } from "@/components/research/ResearchList";
import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Drafts" };

/**
 * Research that is not public yet.
 *
 * The complement of the Research section: anything whose status is not
 * `published` has not reached a published journal, and no visitor can see it.
 * Splitting them this way means "is this public?" is answered by which page a
 * paper appears on, rather than by reading a status badge carefully.
 *
 * Read-only in this session, for the same reason as the Research section.
 */
export default async function CmsDraftsPage() {
  await requireSchoolAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("research_projects")
    .select(
      "id, title, slug, status, research_type, authorship_mode, team_name, research_area, updated_at",
    )
    .neq("status", "published")
    .order("updated_at", { ascending: false });

  const rows = (data ?? []) as ResearchRow[];

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
          Drafts
        </h1>
        <p className="mt-2 max-w-prose text-ink-body">
          Research that has not been published. Nothing here is visible to the
          public. {rows.length} {rows.length === 1 ? "paper" : "papers"}.
        </p>
      </header>

      <section className="rule-notebook mt-10 pt-8" aria-labelledby="unpublished">
        <h2 id="unpublished" className="sr-only">
          Unpublished research
        </h2>
        <ResearchList
          rows={rows}
          empty="Nothing is in draft. Every paper on record has been published."
        />
      </section>
    </>
  );
}
