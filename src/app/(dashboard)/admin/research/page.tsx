import { ResearchList, type ResearchRow } from "@/components/research/ResearchList";
import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Research" };

/**
 * Research that is public.
 *
 * A paper is public when it appears in a journal that has been published —
 * the same rule the public archive uses, so this page and the public Research
 * page can never disagree about what is visible.
 *
 * Read-only in this session. Creating and editing research through the CMS is
 * later work; until it exists, this shows what the archive currently holds
 * rather than offering controls that would not do anything.
 */
export default async function CmsResearchPage() {
  await requireSchoolAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("research_projects")
    .select(
      "id, title, slug, status, research_type, authorship_mode, team_name, research_area, updated_at",
    )
    .eq("status", "published")
    .order("title");

  const rows = (data ?? []) as ResearchRow[];

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
          Research
        </h1>
        <p className="mt-2 max-w-prose text-ink-body">
          Research that has been published in a journal and appears in the
          public archive. {rows.length} {rows.length === 1 ? "paper" : "papers"}.
        </p>
      </header>

      <section className="rule-notebook mt-10 pt-8" aria-labelledby="published">
        <h2 id="published" className="sr-only">
          Published research
        </h2>
        <ResearchList
          rows={rows}
          empty="No research has been published yet."
        />
      </section>
    </>
  );
}
