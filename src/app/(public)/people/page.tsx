import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "People" };

/**
 * The public People page.
 *
 * Four things, in the order the school asked for them: founders and
 * contributors, current leadership, current members, and a link to the past.
 *
 * The three are deliberately different kinds of record. A contributor is a
 * permanent credit and not a member of anything — the Research Cell did not
 * exist while some of them were at the school. Leadership is a position held,
 * read from leadership_positions, so a vacant post is simply absent here. A
 * member is someone the Research Cell listed for an academic year, which is
 * what having a status means. And a person recorded only so their name stays
 * on a paper is an author: they appear with their research, not here.
 */

type FounderRow = {
  id: string;
  role_title: string;
  description: string | null;
  people: { full_name: string } | null;
};

type MemberRow = {
  id: string;
  full_name: string;
  academic_year_text: string | null;
};

type LeadershipRow = {
  id: string;
  title: string;
  full_name: string;
  academic_year: string | null;
};

export default async function PeoplePage() {
  const supabase = await createClient();

  const [{ data: founders }, { data: current }, { data: posts }, { count: pastCount }] =
    await Promise.all([
      supabase
        .from("founding_contributors")
        .select("id, role_title, description, display_order, people(full_name)")
        .order("display_order"),
      supabase
        .from("current_people")
        .select("id, full_name, academic_year_text")
        .order("full_name"),
      // Only filled positions are in this view, so a vacant one simply is not
      // here. Nothing on the page has to know that a position exists unfilled.
      supabase
        .from("current_leadership")
        .select("id, title, full_name, academic_year, display_order")
        .order("display_order"),
      supabase.from("past_people").select("id", { count: "exact", head: true }),
    ]);

  const members = (current ?? []) as MemberRow[];
  const leadership = (posts ?? []) as LeadershipRow[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="rule-notebook pt-8">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">People</h1>
      </header>

      <section className="mt-16" aria-labelledby="founders">
        <h2 id="founders" className="font-heading text-2xl font-bold text-ink-strong">
          Founders and Contributors
        </h2>

        {(founders ?? []).length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-border-subtle bg-surface-muted p-8 text-center text-sm text-ink-muted">
            The founders have not been recorded yet.
          </p>
        ) : (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2">
            {((founders ?? []) as unknown as FounderRow[]).map((f) => (
              <li key={f.id} className="rounded-lg border border-border-subtle bg-surface p-5">
                <p className="font-ui text-sm font-bold text-lgs-600">{f.role_title}</p>
                <h3 className="mt-1 font-heading text-xl font-bold text-ink-strong">
                  {f.people?.full_name}
                </h3>
                {f.description && (
                  <p className="mt-2 text-sm leading-relaxed text-ink-body">{f.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-16" aria-labelledby="leadership">
        <h2 id="leadership" className="font-heading text-2xl font-bold text-ink-strong">
          Current leadership
        </h2>

        {leadership.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-border-subtle bg-surface-muted p-8 text-center text-sm text-ink-muted">
            This year&rsquo;s leadership has not been announced yet.
          </p>
        ) : (
          <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {leadership.map((p) => (
              <li key={p.id} className="text-center">
                {/* Title above the name, as the original design had it. */}
                <p className="font-ui text-sm font-bold text-lgs-600">{p.title}</p>
                <h3 className="mt-1 font-heading text-xl font-bold text-ink-strong">
                  {p.full_name}
                </h3>
                {p.academic_year && (
                  <p className="mt-1 font-ui text-xs text-ink-muted">{p.academic_year}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-16" aria-labelledby="members">
        <h2 id="members" className="font-heading text-2xl font-bold text-ink-strong">
          Current members
        </h2>

        {members.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-border-subtle bg-surface-muted p-8 text-center text-sm text-ink-muted">
            This year&rsquo;s members have not been listed yet.
          </p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((p) => (
              <li key={p.id} className="rounded-lg border border-border-subtle bg-surface p-4">
                <h3 className="font-heading text-base font-bold text-ink-strong">
                  {p.full_name}
                </h3>
                {p.academic_year_text && (
                  <p className="mt-0.5 font-ui text-xs text-ink-muted">{p.academic_year_text}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-16" aria-labelledby="past">
        <h2 id="past" className="font-heading text-2xl font-bold text-ink-strong">
          Past members
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink-body">
          Everyone who has been part of the Research Cell in previous years,
          with the leadership of each year.
        </p>
        <Link
          href="/people/past"
          className="mt-5 inline-block rounded bg-cell-ink px-5 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep"
        >
          View past members
          {typeof pastCount === "number" && pastCount > 0 ? ` (${pastCount})` : ""}
        </Link>
      </section>
    </div>
  );
}
