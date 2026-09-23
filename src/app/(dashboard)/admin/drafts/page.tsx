import Link from "next/link";

import { ResearchList, type ResearchRow } from "@/components/research/ResearchList";
import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Drafts" };

/**
 * Research that is not public.
 *
 * The complement of the Research section, so "is this public?" is answered by
 * which page a paper appears on rather than by reading a badge carefully.
 * Nothing listed here is reachable by a visitor, by URL or otherwise.
 */
export default async function CmsDraftsPage() {
  await requireSchoolAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("research_projects")
    .select(
      "id, title, slug, status, research_type, authorship_mode, team_name, research_area, supervisor, pdf_path, updated_at",
    )
    .eq("status", "draft")
    .order("updated_at", { ascending: false });

  const rows = (data ?? []) as ResearchRow[];

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
            Drafts
          </h1>
          <p className="mt-2 max-w-prose text-ink-body">
            Not published, and not visible to anyone outside this management
            area. {rows.length} {rows.length === 1 ? "paper" : "papers"}.
          </p>
        </div>
        <Link
          href="/admin/research/new"
          className="rounded bg-cell-ink px-4 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep"
        >
          New research
        </Link>
      </header>

      <section className="rule-notebook mt-10 pt-8" aria-labelledby="unpublished">
        <h2 id="unpublished" className="sr-only">
          Draft research
        </h2>
        <ResearchList
          rows={rows}
          empty="No drafts. Everything on record has been published."
        />
      </section>
    </>
  );
}
