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
 * Reads published_research, which returns a paper when the paper itself is
 * published. It used to return a paper when some journal containing it was
 * published; research now stands on its own, and a paper need never appear in
 * a journal to be readable.
 *
 * A draft cannot appear here — not because this query filters it out, but
 * because Row Level Security does not return it to an anonymous caller at all.
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
  const fYear = one("year");

  const supabase = await createClient();

  const [{ data: rows }, { data: bylines }] = await Promise.all([
    supabase
      .from("published_research")
      .select(
        "id, title, slug, abstract, research_area, supervisor, research_type, authorship_mode, team_name, subject_name, academic_year, published_at",
      )
      .order("title"),
    supabase
      .from("published_research_authors")
      .select("project_id, author_order, full_name"),
  ]);

  const all = rows ?? [];

  const authorsFor = (id: string) =>
    (bylines ?? [])
      .filter((b) => b.project_id === id)
      .sort((a, b) => a.author_order - b.author_order)
      .map((b) => b.full_name);

  const filtered = all.filter(
    (p) =>
      (!fType || p.research_type === fType) &&
      (!fSubject || p.subject_name === fSubject) &&
      (!fYear || p.academic_year === fYear),
  );

  const subjects = [...new Set(all.map((p) => p.subject_name).filter(Boolean))].sort();
  const years = [...new Set(all.map((p) => p.academic_year).filter(Boolean))].sort().reverse();
  const types = [
    { value: "primary", label: "Primary" },
    { value: "secondary", label: "Secondary" },
    { value: "independent", label: "Independent" },
  ];
  const typesPresent = types.filter((t) => all.some((p) => p.research_type === t.value));

  const linkFor = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { type: fType, subject: fSubject, year: fYear, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/research?${s}` : "/research";
  };

  const typeLabel = (t: string | null) =>
    t === "primary" ? "Primary Research"
      : t === "secondary" ? "Secondary Research"
      : t === "independent" ? "Independent Research"
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="rule-notebook pt-8">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">Research</h1>
        <p className="mt-4 max-w-prose text-lg text-ink-body">
          Research published by the 1A1 Research Cell.
        </p>
      </header>

      {all.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-border-subtle bg-surface-muted p-10 text-center text-sm text-ink-muted">
          No research has been published yet.
        </p>
      ) : (
        <>
          <div className="mt-10 space-y-3">
            {typesPresent.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-ui text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  Type
                </span>
                <Chip href={linkFor({ type: undefined })} active={!fType}>
                  All
                </Chip>
                {typesPresent.map((t) => (
                  <Chip key={t.value} href={linkFor({ type: t.value })} active={fType === t.value}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            )}

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

            {years.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-ui text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  Year
                </span>
                <Chip href={linkFor({ year: undefined })} active={!fYear}>
                  All
                </Chip>
                {years.map((y) => (
                  <Chip key={y} href={linkFor({ year: y as string })} active={fYear === y}>
                    {y}
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
              const authors = authorsFor(p.id);
              return (
                <li key={p.id} className="border-l-2 border-border-subtle pl-5">
                  <p className="font-ui text-xs text-ink-muted">
                    {[
                      typeLabel(p.research_type),
                      p.subject_name,
                      p.research_area,
                      p.academic_year,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <h2 className="mt-1.5 font-heading text-lg font-bold text-ink-strong">
                    <Link
                      href={`/research/${p.slug}`}
                      className="text-ink-strong underline decoration-border-subtle underline-offset-2 transition-colors hover:text-lgs-600 hover:decoration-lgs-500"
                    >
                      {p.title}
                    </Link>
                  </h2>
                  {p.team_name && (
                    <p className="mt-1 font-ui text-sm font-medium text-lgs-600">{p.team_name}</p>
                  )}
                  {authors.length > 0 && (
                    <p className="mt-1 font-ui text-sm text-ink-body">{authors.join(", ")}</p>
                  )}
                  {p.supervisor && (
                    <p className="mt-1 font-ui text-xs text-ink-muted">
                      Supervised by {p.supervisor}
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
