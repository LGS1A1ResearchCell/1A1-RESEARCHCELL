import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "People" };

/**
 * The public People page.
 *
 * Three groups, deliberately distinct:
 *
 *   Founders and permanent contributors — a fixed historical record that never
 *     rotates. Held in founding_contributors rather than the leadership table,
 *     so a new Head of Research can never displace them.
 *
 *   Current leadership — Head and Deputy Head of Research, appointed annually.
 *     Past years remain queryable and are listed beneath.
 *
 *   Researchers — everyone whose profile School Administration has published.
 *
 * All of this is read anonymously. people_public_read limits the rows to
 * is_public, so this page cannot show a student administration has not
 * published, whatever the query asks for.
 */

/** Leadership titles, rendered above the name as the brief specifies. */
const ROLE_TITLE: Record<string, string> = {
  head_of_research: "Head of Research",
  deputy_head_of_research: "Deputy Head of Research",
};

type PersonBits = {
  full_name: string;
  quote: string | null;
};

type LeadRow = {
  id: string;
  role: string;
  academic_years: { label: string; is_current: boolean } | null;
  people: PersonBits | null;
};

export default async function PeoplePage() {
  const supabase = await createClient();

  const [{ data: founders }, { data: leadership }, { data: researchers }] =
    await Promise.all([
      supabase
        .from("founding_contributors")
        .select(
          "id, role_title, description, year, display_order, people(full_name, quote)",
        )
        .order("display_order"),
      supabase
        .from("leadership")
        .select(
          "id, role, academic_years(label, is_current), people(full_name, quote)",
        ),
      supabase
        .from("public_researchers")
        .select(
          "id, full_name, slug, kind, class_section, year_joined, quote, published_paper_count",
        )
        .order("full_name"),
    ]);

  const leads = (leadership ?? []) as unknown as LeadRow[];
  const current = leads.filter((l) => l.academic_years?.is_current);
  const past = leads
    .filter((l) => !l.academic_years?.is_current)
    .sort((a, b) =>
      (b.academic_years?.label ?? "").localeCompare(a.academic_years?.label ?? ""),
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="rule-notebook pt-8">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">People</h1>
        <p className="mt-4 max-w-prose text-lg text-ink-body">
          The founders of the Research Cell, its current leadership, and the
          researchers whose work appears in the archive.
        </p>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Founders                                                          */}
      {/* ---------------------------------------------------------------- */}
      {(founders ?? []).length > 0 && (
        <section className="mt-16" aria-labelledby="founders">
          <h2 id="founders" className="font-heading text-2xl font-bold text-ink-strong">
            Founders and permanent contributors
          </h2>
          <p className="mt-2 max-w-prose text-sm text-ink-body">
            A permanent record. These contributions do not change with the
            academic year.
          </p>

          <ul className="mt-8 grid gap-6 sm:grid-cols-2">
            {(founders ?? []).map((f) => {
              const p = f.people as unknown as PersonBits | null;
              return (
                <li
                  key={f.id}
                  className="flex gap-5 rounded-lg border border-border-subtle bg-surface p-5"
                >
                  <div className="min-w-0">
                    <p className="font-ui text-sm font-bold text-lgs-600">
                      {f.role_title}
                      {f.year ? `, ${f.year}` : ""}
                    </p>
                    <h3 className="mt-0.5 font-heading text-lg font-bold text-ink-strong">
                      {p?.full_name}
                    </h3>
                    {f.description && (
                      <p className="mt-2 text-sm leading-relaxed text-ink-body">
                        {f.description}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Current leadership                                                */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-16" aria-labelledby="leadership">
        <h2 id="leadership" className="font-heading text-2xl font-bold text-ink-strong">
          Current leadership
        </h2>

        {current.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-border-subtle bg-surface-muted p-8 text-center text-sm text-ink-muted">
            Leadership for the current academic year has not been announced.
          </p>
        ) : (
          <ul className="mt-8 grid gap-8 sm:grid-cols-2">
            {current.map((l) => (
              <li key={l.id} className="text-center">
                {/* Title above the name, bold, smaller, blue — as specified. */}
                <p className="mt-4 font-ui text-sm font-bold text-lgs-600">
                  {ROLE_TITLE[l.role] ?? l.role}
                </p>
                <h3 className="mt-1 font-heading text-xl font-bold text-ink-strong">
                  {l.people?.full_name}
                </h3>
                {l.people?.quote && (
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-body italic">
                    &ldquo;{l.people.quote}&rdquo;
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {past.length > 0 && (
          <div className="mt-12">
            <h3 className="font-ui text-sm font-semibold tracking-wide text-ink-strong uppercase">
              Previous leadership
            </h3>
            <ul className="mt-4 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
              {past.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3"
                >
                  <span className="font-ui text-sm text-ink-strong">
                    <span className="font-semibold">{l.people?.full_name}</span>
                    <span className="text-ink-muted">
                      {" "}
                      — {ROLE_TITLE[l.role] ?? l.role}
                    </span>
                  </span>
                  <span className="font-ui text-xs text-ink-muted">
                    {l.academic_years?.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Researchers                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-16" aria-labelledby="researchers">
        <h2 id="researchers" className="font-heading text-2xl font-bold text-ink-strong">
          Researchers
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink-body">
          Members of the Research Cell whose work appears in the published
          archive.
        </p>

        {(researchers ?? []).length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-border-subtle bg-surface-muted p-8 text-center text-sm text-ink-muted">
            No profiles are currently published.
          </p>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(researchers ?? []).map((r) => (
              <li
                key={r.id}
                className="flex gap-4 rounded-lg border border-border-subtle bg-surface p-4"
              >
                <div className="min-w-0">
                  <h3 className="font-heading text-base font-bold text-ink-strong">
                    {r.full_name}
                  </h3>
                  <p className="mt-0.5 font-ui text-xs text-ink-muted">
                    {[
                      r.kind === "faculty" ? "Faculty" : null,
                      r.class_section ? `Class ${r.class_section}` : null,
                      r.year_joined ? `Joined ${r.year_joined}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Research Cell"}
                  </p>
                  {Number(r.published_paper_count) > 0 && (
                    <p className="mt-1.5 font-ui text-xs font-medium text-lgs-600">
                      {r.published_paper_count} published{" "}
                      {Number(r.published_paper_count) === 1 ? "paper" : "papers"}
                    </p>
                  )}
                  {r.quote && (
                    <p className="mt-2 text-sm leading-relaxed text-ink-body italic">
                      &ldquo;{r.quote}&rdquo;
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
