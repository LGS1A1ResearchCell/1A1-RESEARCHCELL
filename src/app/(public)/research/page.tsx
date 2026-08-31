import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Research" };

type ChipProps = { href: string; active: boolean; children: React.ReactNode };

/** Defined at module scope: a component created during render remounts its subtree. */
function Chip({ href, active, children }: ChipProps) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 font-ui text-xs transition-colors ${
        active
          ? "border-lgs-600 bg-lgs-50 font-semibold text-lgs-700"
          : "border-border-subtle text-ink-body hover:border-lgs-500"
      }`}
    >
      {children}
    </Link>
  );
}

/**
 * The public research library.
 *
 * Papers appear here only once they are in a published journal — the same rule
 * is_project_public() applies everywhere else, and the view this reads from
 * joins through to journals and returns published issues only.
 *
 * The filters are deliberately shallow: type, subject and journal, matching the
 * taxonomy the archive actually uses rather than one invented ahead of the
 * school deciding what its research covers.
 */
export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const fType = one("type");
  const fSubject = one("subject");
  const fJournal = one("journal");

  const supabase = await createClient();

  const [{ data: rows }, { data: bylines }, { data: journals }] = await Promise.all([
    supabase
      .from("published_journal_papers")
      .select(
        "journal_id, project_id, title, abstract, research_type, authorship_mode, team_name, research_area, subject_name, start_page",
      )
      .order("title"),
    supabase.from("published_paper_authors").select("project_id, author_order, full_name"),
    supabase
      .from("journals")
      .select("id, title, slug, academic_years(label)")
      .order("published_at", { ascending: false }),
  ]);

  const all = rows ?? [];
  const journalOf = new Map(
    (journals ?? []).map((j) => [
      j.id,
      {
        title: j.title,
        slug: j.slug,
        year: (j.academic_years as unknown as { label: string } | null)?.label ?? null,
      },
    ]),
  );

  const authorsFor = (id: string) =>
    (bylines ?? [])
      .filter((b) => b.project_id === id)
      .sort((a, b) => a.author_order - b.author_order)
      .map((b) => b.full_name);

  const filtered = all.filter(
    (p) =>
      (!fType || p.research_type === fType) &&
      (!fSubject || p.subject_name === fSubject) &&
      (!fJournal || journalOf.get(p.journal_id)?.slug === fJournal),
  );

  const subjects = [...new Set(all.map((p) => p.subject_name).filter(Boolean))].sort();
  const types = [
    { value: "primary", label: "Primary" },
    { value: "secondary", label: "Secondary" },
    { value: "independent", label: "Independent" },
  ];

  const linkFor = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { type: fType, subject: fSubject, journal: fJournal, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/research?${s}` : "/research";
  };

  const typeLabel = (t: string) =>
    t === "primary" ? "Primary Research"
      : t === "secondary" ? "Secondary Research"
      : "Independent Research";

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="rule-notebook pt-8">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">Research</h1>
        <p className="mt-4 max-w-prose text-lg text-ink-body">
          Research published by the 1A1 Research Cell. Papers appear here once
          they have been included in a published journal.
        </p>
      </header>

      {all.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-border-subtle bg-surface-muted p-10 text-center text-sm text-ink-muted">
          No research has been published yet.
        </p>
      ) : (
        <>
          <div className="mt-10 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-ui text-xs font-semibold tracking-wide text-ink-muted uppercase">
                Type
              </span>
              <Chip href={linkFor({ type: undefined })} active={!fType}>
                All
              </Chip>
              {types.map((t) => (
                <Chip key={t.value} href={linkFor({ type: t.value })} active={fType === t.value}>
                  {t.label}
                </Chip>
              ))}
            </div>

            {subjects.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-ui text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  Subject
                </span>
                <Chip href={linkFor({ subject: undefined })} active={!fSubject}>
                  All
                </Chip>
                {subjects.map((s) => (
                  <Chip key={s} href={linkFor({ subject: s as string })} active={fSubject === s}>
                    {s}
                  </Chip>
                ))}
              </div>
            )}

            {(journals ?? []).length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-ui text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  Journal
                </span>
                <Chip href={linkFor({ journal: undefined })} active={!fJournal}>
                  All
                </Chip>
                {(journals ?? []).map((j) => (
                  <Chip key={j.id} href={linkFor({ journal: j.slug })} active={fJournal === j.slug}>
                    {j.title}
                  </Chip>
                ))}
              </div>
            )}
          </div>

          <p className="mt-6 font-ui text-sm text-ink-muted">
            {filtered.length} of {all.length} {all.length === 1 ? "paper" : "papers"}
          </p>

          <ol className="mt-6 space-y-8">
            {filtered.map((p) => {
              const j = journalOf.get(p.journal_id);
              const authors = authorsFor(p.project_id);
              return (
                <li key={p.project_id} className="border-l-2 border-border-subtle pl-5">
                  <p className="font-ui text-xs text-ink-muted">
                    {[
                      typeLabel(p.research_type),
                      p.authorship_mode === "team" ? "Team research" : "Individual research",
                      p.subject_name,
                      p.research_area,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <h2 className="mt-1.5 font-heading text-lg font-bold text-ink-strong">
                    {p.title}
                  </h2>
                  {p.team_name && (
                    <p className="mt-1 font-ui text-sm font-medium text-lgs-600">{p.team_name}</p>
                  )}
                  {authors.length > 0 && (
                    <p className="mt-1 font-ui text-sm text-ink-body">{authors.join(", ")}</p>
                  )}
                  {p.abstract && (
                    <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-body">
                      {p.abstract}
                    </p>
                  )}
                  {j && (
                    <p className="mt-3 font-ui text-xs text-ink-muted">
                      Published in{" "}
                      <Link href={`/journals/${j.slug}`} className="text-lgs-600 underline">
                        {j.title}
                      </Link>
                      {j.year ? ` · ${j.year}` : ""}
                      {p.start_page ? ` · p. ${p.start_page}` : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>

          {filtered.length === 0 && (
            <p className="mt-6 rounded-lg border border-dashed border-border-subtle bg-surface-muted p-8 text-center text-sm text-ink-muted">
              No papers match those filters.{" "}
              <Link href="/research" className="text-lgs-600 underline">
                Clear them
              </Link>
              .
            </p>
          )}
        </>
      )}
    </div>
  );
}
