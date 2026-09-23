import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * The tab and search title name the paper rather than saying "Research".
 * Resolved from the same public view the page uses, so a draft yields nothing
 * here either.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("published_research")
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
 * Everything is read through published_research and
 * published_research_authors, both of which return rows only for papers whose
 * status is `published`. A draft therefore does not resolve here: it reaches a
 * 404, and it does so because the database returned nothing, not because this
 * file checked a flag.
 *
 * The PDF is signed rather than linked directly. The bucket is private, and an
 * anonymous visitor may read an object only when it belongs to a published
 * paper — so unpublishing a paper withdraws its PDF too, without anything here
 * having to remember to.
 */
export default async function PaperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: paper } = await supabase
    .from("published_research")
    .select(
      "id, title, slug, abstract, research_area, supervisor, references_text, research_type, authorship_mode, team_name, pdf_path, pdf_filename, published_at, subject_name, academic_year",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!paper) notFound();

  const [{ data: bylines }, { data: appearance }] = await Promise.all([
    supabase
      .from("published_research_authors")
      .select("author_role, author_order, full_name")
      .eq("project_id", paper.id)
      .order("author_order"),
    // A paper may also have been collected into a journal. That is extra
    // context, not what makes it public.
    supabase
      .from("journal_papers")
      .select("start_page, end_page, journals(title, slug, status)")
      .eq("project_id", paper.id)
      .maybeSingle(),
  ]);

  const authors = bylines ?? [];
  const journal = (appearance?.journals as unknown as
    | { title: string; slug: string; status: string }
    | null) ?? null;
  const inPublishedJournal = journal?.status === "published";

  let pdfUrl: string | null = null;
  if (paper.pdf_path) {
    const { data } = await supabase.storage
      .from("research-submissions")
      .createSignedUrl(paper.pdf_path, 60 * 60);
    pdfUrl = data?.signedUrl ?? null;
  }

  const typeLabel =
    paper.research_type === "primary"
      ? "Primary Research"
      : paper.research_type === "secondary"
        ? "Secondary Research"
        : paper.research_type === "independent"
          ? "Independent Research"
          : null;

  const meta = [
    typeLabel,
    paper.authorship_mode === "team" ? "Team research" : null,
    paper.subject_name,
    paper.research_area,
    paper.academic_year,
  ].filter(Boolean);

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
        {meta.length > 0 && (
          <p className="font-ui text-xs text-ink-muted">{meta.join(" · ")}</p>
        )}

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

        {paper.supervisor && (
          <p className="mt-2 font-ui text-sm text-ink-muted">
            Supervised by {paper.supervisor}
          </p>
        )}

        {pdfUrl && (
          <a
            href={pdfUrl}
            className="mt-6 inline-block rounded bg-cell-ink px-5 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep"
          >
            Read the paper (PDF)
          </a>
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

      {paper.references_text && (
        <section className="mt-12" aria-labelledby="references">
          <h2 id="references" className="font-heading text-xl font-bold text-ink-strong">
            References
          </h2>
          {/* Kept exactly as written, line by line. The school has not settled
              on a citation style, and reformatting would rewrite the authors'
              work rather than present it. */}
          <ul className="mt-3 max-w-prose space-y-2">
            {String(paper.references_text)
              .split("\n")
              .map((line: string) => line.trim())
              .filter(Boolean)
              .map((line: string, i: number) => (
                <li key={i} className="text-sm leading-relaxed text-ink-body">
                  {line}
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="mt-12" aria-labelledby="publication">
        <h2 id="publication" className="font-heading text-xl font-bold text-ink-strong">
          Publication
        </h2>
        <p className="mt-3 text-ink-body">
          Published by the 1A1 Research Cell
          {paper.academic_year ? `, ${paper.academic_year}` : ""}
          {paper.published_at
            ? ` · ${new Date(paper.published_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}`
            : ""}
          .
        </p>

        {inPublishedJournal && journal && (
          <p className="mt-2 text-ink-body">
            Collected in{" "}
            <Link href={`/journals/${journal.slug}`} className="text-lgs-600 underline">
              {journal.title}
            </Link>
            {appearance?.start_page
              ? `, pp. ${appearance.start_page}–${appearance.end_page ?? appearance.start_page}`
              : ""}
            .
          </p>
        )}

        {!pdfUrl && (
          /* No link rather than a broken one. */
          <p className="mt-5 max-w-prose rounded-lg border border-dashed border-border-subtle bg-surface-muted p-5 text-sm leading-relaxed text-ink-body">
            The full text of this paper is not available to read online.
          </p>
        )}
      </section>
    </div>
  );
}
