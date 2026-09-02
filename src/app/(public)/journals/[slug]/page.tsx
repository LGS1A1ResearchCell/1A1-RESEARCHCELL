import Link from "next/link";
import { notFound } from "next/navigation";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * The tab and search title name the issue rather than saying "Journal".
 * Resolved from the same RLS-limited query the page uses, so an unpublished
 * issue yields nothing here either.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("journals")
    .select("title, description")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return { title: "Journal" };
  return {
    title: data.title,
    description:
      data.description ??
      `${data.title} of the 1A1 Research Cell, Lahore Grammar School 1-A-1.`,
  };
}

/**
 * A published journal.
 *
 * Every query here runs anonymously. The journal row itself is limited to
 * published issues by RLS; the contents and bylines come from views that join
 * through to journals and return rows only where the issue is published. An
 * unpublished journal reaches a 404 rather than a partial page.
 */
export default async function JournalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: journal } = await supabase
    .from("journals")
    .select(
      "id, title, volume_label, description, cover_path, pdf_path, published_at, academic_years(label)",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!journal) notFound();

  const [{ data: papers }, { data: bylines }, { data: credits }, { data: corrections }] =
    await Promise.all([
      supabase
        .from("published_journal_papers")
        .select(
          "project_id, display_order, start_page, end_page, title, slug, abstract, research_type, authorship_mode, team_name, research_area, subject_name",
        )
        .eq("journal_id", journal.id)
        .order("display_order"),
      supabase
        .from("published_paper_authors")
        .select("project_id, author_role, author_order, full_name")
        .eq("journal_id", journal.id)
        .order("author_order"),
      supabase
        .from("journal_credits")
        .select("id, credit_title, display_order, people(full_name)")
        .eq("journal_id", journal.id)
        .order("display_order"),
      supabase
        .from("journal_corrections")
        .select("id, description, approved_at")
        .eq("journal_id", journal.id)
        .order("approved_at", { ascending: false }),
    ]);

  const authorsFor = (projectId: string) =>
    (bylines ?? [])
      .filter((b) => b.project_id === projectId)
      .sort((a, b) => a.author_order - b.author_order);

  const year = (journal.academic_years as unknown as { label: string } | null)?.label;
  const coverUrl = journal.cover_path
    ? `${env.supabaseUrl}/storage/v1/object/public/journal-covers/${journal.cover_path}`
    : null;
  const pdfUrl = journal.pdf_path
    ? `${env.supabaseUrl}/storage/v1/object/public/journal-pdfs/${journal.pdf_path}`
    : null;

  const typeLabel = (t: string) =>
    t === "primary" ? "Primary Research" : t === "secondary" ? "Secondary Research" : "Independent Research";

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="font-ui text-sm text-ink-muted">
        <Link href="/journals" className="text-lgs-600 underline">
          Journals
        </Link>
        {" / "}
        {journal.title}
      </p>

      <header className="rule-notebook mt-4 grid gap-8 pt-8 sm:grid-cols-[14rem_1fr]">
        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-cell-ink">
          {coverUrl ? (
            /* Storage host is not registered with the image optimiser; see the
               archive page for why that is deliberate. */
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt={`Cover of ${journal.title}`} className="h-full w-full object-cover" />
          ) : (
            <div className="p-6 text-center">
              <p className="font-ui text-xs tracking-[0.2em] text-cell-cyan uppercase">
                1A1 Research Cell
              </p>
              <p className="mt-3 font-heading text-2xl font-extrabold text-white">
                {journal.title}
              </p>
              {year && <p className="mt-2 font-ui text-xs text-white/60">{year}</p>}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-heading text-3xl font-extrabold text-ink-strong sm:text-4xl">
            {journal.title}
          </h1>
          <p className="mt-2 font-ui text-sm text-ink-muted">
            {[
              year,
              journal.volume_label ? `Volume ${journal.volume_label}` : null,
              `${(papers ?? []).length} ${(papers ?? []).length === 1 ? "paper" : "papers"}`,
              journal.published_at
                ? `Published ${new Date(journal.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {journal.description && (
            <p className="mt-4 max-w-prose leading-relaxed text-ink-body">
              {journal.description}
            </p>
          )}

          {pdfUrl && (
            <a
              href={pdfUrl}
              className="mt-6 inline-block rounded bg-cell-ink px-5 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep"
            >
              Read the full journal (PDF)
            </a>
          )}
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Contents                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-16" aria-labelledby="contents">
        <h2 id="contents" className="font-heading text-2xl font-bold text-ink-strong">
          Contents
        </h2>

        <ol className="mt-8 space-y-8">
          {(papers ?? []).map((p, i) => {
            const authors = authorsFor(p.project_id);
            return (
              <li key={p.project_id} className="border-l-2 border-border-subtle pl-5">
                <p className="font-ui text-xs text-ink-muted">
                  {[
                    `${i + 1}.`,
                    typeLabel(p.research_type),
                    p.authorship_mode === "team" ? "Team research" : "Individual research",
                    p.subject_name,
                    p.research_area,
                    p.start_page ? `pp. ${p.start_page}–${p.end_page ?? p.start_page}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                <h3 className="mt-1.5 font-heading text-lg font-bold text-ink-strong">
                  <Link
                    href={`/research/${p.slug}`}
                    className="text-ink-strong underline decoration-border-subtle underline-offset-2 transition-colors hover:text-lgs-600 hover:decoration-lgs-500"
                  >
                    {p.title}
                  </Link>
                </h3>

                {p.team_name && (
                  <p className="mt-1 font-ui text-sm font-medium text-lgs-600">{p.team_name}</p>
                )}

                {authors.length > 0 && (
                  <p className="mt-1 font-ui text-sm text-ink-body">
                    {authors.map((a, idx) => (
                      <span key={a.full_name + idx}>
                        {idx > 0 && ", "}
                        {a.full_name}
                        {a.author_role === "team_leader" && (
                          <span className="text-ink-muted"> (Team Leader)</span>
                        )}
                      </span>
                    ))}
                  </p>
                )}

                {p.abstract && (
                  <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-body">
                    {p.abstract}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Masthead                                                            */}
      {/* ------------------------------------------------------------------ */}
      {(credits ?? []).length > 0 && (
        <section className="mt-16" aria-labelledby="masthead">
          <h2 id="masthead" className="font-heading text-2xl font-bold text-ink-strong">
            Editorial
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(credits ?? []).map((c) => (
              <li key={c.id} className="rounded-lg border border-border-subtle bg-surface p-4 text-center">
                <p className="font-ui text-sm font-bold text-lgs-600">{c.credit_title}</p>
                <p className="mt-1 font-heading text-base font-bold text-ink-strong">
                  {(c.people as unknown as { full_name: string } | null)?.full_name}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Corrections                                                         */}
      {/* ------------------------------------------------------------------ */}
      {(corrections ?? []).length > 0 && (
        <section className="mt-16" aria-labelledby="corrections">
          <h2 id="corrections" className="font-heading text-2xl font-bold text-ink-strong">
            Corrections
          </h2>
          <p className="mt-2 max-w-prose text-sm text-ink-body">
            The published record is never rewritten. Corrections are recorded
            separately and remain part of the permanent history.
          </p>
          <ul className="mt-6 space-y-3">
            {(corrections ?? []).map((c) => (
              <li key={c.id} className="rounded-lg border border-border-subtle bg-surface p-4">
                <p className="text-sm leading-relaxed text-ink-body">{c.description}</p>
                {c.approved_at && (
                  <p className="mt-1.5 font-ui text-xs text-ink-muted">
                    Recorded{" "}
                    {new Date(c.approved_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
