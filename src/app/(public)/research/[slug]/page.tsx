import Link from "next/link";
import { notFound } from "next/navigation";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * The tab and search title name the paper rather than saying "Research".
 * Resolved from the same public view the page uses, so a paper that is not in
 * a published journal yields nothing here either.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("published_journal_papers")
    .select("title, abstract")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return { title: "Research" };
  return {
    title: data.title,
    description:
      data.abstract ??
      `${data.title} — research published by the 1A1 Research Cell, Lahore Grammar School 1-A-1.`,
  };
}

/**
 * A single published paper.
 *
 * Every query runs anonymously against published_journal_papers and
 * published_paper_authors, both of which join through to journals and return
 * rows only where the issue is published. So the rule that approval alone
 * exposes nothing holds here without a separate check: a paper that has been
 * approved but not yet published simply does not resolve, and reaches a 404
 * rather than a partial page.
 *
 * The full text lives in the journal PDF, not in a per-paper file — Journal I
 * is a single bound volume and the page range is how a paper is located inside
 * it. Where no PDF has been uploaded yet, this page says so plainly instead of
 * offering a link that would not work.
 */
export default async function PaperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: paper } = await supabase
    .from("published_journal_papers")
    .select(
      "journal_id, project_id, title, slug, abstract, research_type, authorship_mode, team_name, research_area, subject_name, start_page, end_page",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!paper) notFound();

  const [{ data: bylines }, { data: journal }] = await Promise.all([
    supabase
      .from("published_paper_authors")
      .select("author_role, author_order, full_name")
      .eq("project_id", paper.project_id)
      .order("author_order"),
    supabase
      .from("journals")
      .select("title, slug, pdf_path, published_at, academic_years(label)")
      .eq("id", paper.journal_id)
      .maybeSingle(),
  ]);

  const authors = bylines ?? [];
  const year = (journal?.academic_years as unknown as { label: string } | null)?.label;

  // Deep-linked to the paper's first page where the viewer honours the
  // fragment, which every current desktop browser does.
  const pdfUrl = journal?.pdf_path
    ? `${env.supabaseUrl}/storage/v1/object/public/journal-pdfs/${journal.pdf_path}` +
      (paper.start_page ? `#page=${paper.start_page}` : "")
    : null;

  const typeLabel =
    paper.research_type === "primary"
      ? "Primary Research"
      : paper.research_type === "secondary"
        ? "Secondary Research"
        : "Independent Research";

  const pages = paper.start_page
    ? `pp. ${paper.start_page}–${paper.end_page ?? paper.start_page}`
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="font-ui text-sm text-ink-muted">
        <Link href="/research" className="text-lgs-600 underline">
          Research
        </Link>
        {" / "}
        {paper.title}
      </p>

      <header className="rule-notebook mt-4 pt-8">
        <p className="font-ui text-xs text-ink-muted">
          {[
            typeLabel,
            paper.authorship_mode === "team" ? "Team research" : "Individual research",
            paper.subject_name,
            paper.research_area,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <h1 className="mt-2 max-w-prose font-heading text-3xl font-extrabold text-ink-strong sm:text-4xl">
          {paper.title}
        </h1>

        {paper.team_name && (
          <p className="mt-3 font-ui text-base font-medium text-lgs-600">{paper.team_name}</p>
        )}

        {authors.length > 0 && (
          <p className="mt-2 font-ui text-base text-ink-body">
            {authors.map((a, i) => (
              <span key={a.full_name + i}>
                {i > 0 && ", "}
                {a.full_name}
                {a.author_role === "team_leader" && (
                  <span className="text-ink-muted"> (Team Leader)</span>
                )}
              </span>
            ))}
          </p>
        )}
      </header>

      {paper.abstract && (
        <section className="mt-12" aria-labelledby="abstract">
          <h2 id="abstract" className="font-heading text-xl font-bold text-ink-strong">
            Abstract
          </h2>
          <p className="mt-3 max-w-prose leading-relaxed text-ink-body">{paper.abstract}</p>
        </section>
      )}

      <section className="mt-12" aria-labelledby="publication">
        <h2 id="publication" className="font-heading text-xl font-bold text-ink-strong">
          Publication
        </h2>

        {journal ? (
          <>
            <p className="mt-3 text-ink-body">
              Published in{" "}
              <Link href={`/journals/${journal.slug}`} className="text-lgs-600 underline">
                {journal.title}
              </Link>
              {[
                year,
                pages,
                journal.published_at
                  ? new Date(journal.published_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : null,
              ]
                .filter(Boolean)
                .map((bit) => ` · ${bit}`)
                .join("")}
              .
            </p>

            {pdfUrl ? (
              <a
                href={pdfUrl}
                className="mt-5 inline-block rounded bg-cell-ink px-5 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep"
              >
                Read this paper in {journal.title} (PDF
                {paper.start_page ? `, from p. ${paper.start_page}` : ""})
              </a>
            ) : (
              /* No link rather than a broken one. The journal PDF has not been
                 uploaded, and inventing a destination would be worse than
                 saying so. */
              <p className="mt-5 max-w-prose rounded-lg border border-dashed border-border-subtle bg-surface-muted p-5 text-sm leading-relaxed text-ink-body">
                The full text of this paper is published in {journal.title}
                {pages ? `, ${pages}` : ""}. The journal is not yet available to
                read online.
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 text-ink-body">
            This paper appears in a published journal of the 1A1 Research Cell.
          </p>
        )}
      </section>
    </div>
  );
}
