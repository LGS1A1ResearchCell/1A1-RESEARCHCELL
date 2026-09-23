import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ResearchEditor,
  type AuthorRow,
  type Option,
  type ResearchRecord,
} from "@/components/research/ResearchEditor";
import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit research" };

/**
 * Editing one paper, draft or published.
 *
 * The same page for both: the difference between a draft and a published paper
 * is one field, not a different workflow, and having two screens would imply
 * otherwise.
 */
export default async function EditResearchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSchoolAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: record }, { data: authorRows }, { data: years }, { data: subjects }] =
    await Promise.all([
      supabase
        .from("research_projects")
        .select(
          "id, title, slug, status, abstract, research_area, supervisor, references_text, academic_year_id, subject_id, pdf_path, pdf_filename",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("research_authors")
        .select("id, author_order, people(full_name)")
        .eq("project_id", id)
        .order("author_order"),
      supabase.from("academic_years").select("id, label").order("label", { ascending: false }),
      supabase.from("subjects").select("id, name").order("name"),
    ]);

  if (!record) notFound();

  const authors: AuthorRow[] = (authorRows ?? []).map((r) => ({
    id: r.id as string,
    full_name:
      (r.people as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
  }));

  const yearOptions: Option[] = (years ?? []).map((y) => ({
    id: y.id as string,
    label: y.label as string,
  }));
  const subjectOptions: Option[] = (subjects ?? []).map((s) => ({
    id: s.id as string,
    label: s.name as string,
  }));

  const published = record.status === "published";

  return (
    <>
      <p className="font-ui text-sm text-ink-muted">
        <Link
          href={published ? "/admin/research" : "/admin/drafts"}
          className="text-lgs-600 underline"
        >
          {published ? "Research" : "Drafts"}
        </Link>
        {" / "}
        {record.title}
      </p>

      <header className="mt-4">
        <h1 className="max-w-prose font-heading text-3xl font-extrabold text-ink-strong">
          {record.title}
        </h1>
        {published && record.slug && (
          <p className="mt-2 font-ui text-sm text-ink-muted">
            Public page:{" "}
            <Link href={`/research/${record.slug}`} className="text-lgs-600 underline">
              /research/{record.slug}
            </Link>
          </p>
        )}
      </header>

      <ResearchEditor
        record={record as ResearchRecord}
        authors={authors}
        years={yearOptions}
        subjects={subjectOptions}
      />
    </>
  );
}
