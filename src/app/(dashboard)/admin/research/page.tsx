import Link from "next/link";

import { ResearchList, type ResearchRow } from "@/components/research/ResearchList";
import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Research" };

/**
 * Research that is public.
 *
 * A paper is public when its own status says so. It does not need to be in a
 * journal, and putting it in one does not publish it — the two are separate
 * decisions now.
 */
export default async function CmsResearchPage() {
  await requireSchoolAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("research_projects")
    .select(
      "id, title, slug, status, research_type, authorship_mode, team_name, research_area, supervisor, pdf_path, updated_at",
    )
    .eq("status", "published")
    .order("title");

  const rows = (data ?? []) as ResearchRow[];

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
            Research
          </h1>
          <p className="mt-2 max-w-prose text-ink-body">
            Published and visible on the public Research page.{" "}
            {rows.length} {rows.length === 1 ? "paper" : "papers"}.
          </p>
        </div>
        <Link
          href="/admin/research/new"
          className="rounded bg-cell-ink px-4 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep"
        >
          New research
        </Link>
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
