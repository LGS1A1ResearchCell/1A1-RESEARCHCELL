import Link from "next/link";

import {
  LeadershipPositions,
  type Candidate,
  type Position,
} from "@/components/people/LeadershipPositions";
import { NewPersonForm, PersonRow, type Person } from "@/components/people/PeopleEditor";
import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit People" };

/**
 * Edit People.
 *
 * Everyone the Research Cell lists, in three groups, so that current and past
 * are told apart at a glance rather than by reading a badge on every row.
 *
 * Founders are shown but not editable, and the page says why. Leaving them off
 * entirely would be tidier and more confusing: someone would eventually go
 * looking for the place to change them.
 *
 * People who appear here are people with a status. Authors recorded only so a
 * byline survives are not members of anything and are not listed.
 */
export default async function EditPeoplePage() {
  await requireSchoolAdmin();
  const supabase = await createClient();

  const [
    { data: people },
    { data: founders },
    { data: positionRows },
    { data: candidateRows },
    { data: historyRows },
  ] = await Promise.all([
    supabase
      .from("people")
      .select("id, full_name, status, leadership_title, academic_year_text, moved_to_past_at")
      .not("status", "is", null)
      .order("full_name"),
    supabase
      .from("founding_contributors")
      .select("id, role_title, year, display_order, people(full_name)")
      .order("display_order"),
    // Vacant positions are needed here, so this reads the table rather than
    // the public view, which returns only the filled ones.
    supabase
      .from("leadership_positions")
      .select("id, title, display_order, person_id, people(full_name), academic_years(label)")
      .order("display_order"),
    // Anyone still current may hold a position, including a permanent
    // contributor who is not a listed member.
    supabase
      .from("people")
      .select("id, full_name")
      .is("moved_to_past_at", null)
      .order("full_name"),
    supabase
      .from("past_leadership")
      .select("id, full_name, title, academic_year_label, ended_at")
      .order("ended_at", { ascending: false }),
  ]);

  const positions: Position[] = (
    (positionRows ?? []) as unknown as {
      id: string;
      title: string;
      display_order: number;
      person_id: string | null;
      people: { full_name: string } | null;
      academic_years: { label: string } | null;
    }[]
  ).map((p) => ({
    id: p.id,
    title: p.title,
    display_order: p.display_order,
    person_id: p.person_id,
    holder_name: p.people?.full_name ?? null,
    academic_year: p.academic_years?.label ?? null,
  }));

  const candidates = (candidateRows ?? []) as Candidate[];
  const history = (historyRows ?? []) as {
    id: string;
    full_name: string;
    title: string;
    academic_year_label: string | null;
  }[];

  const heldBy = new Set(positions.map((p) => p.person_id).filter(Boolean) as string[]);

  const all = (people ?? []) as Person[];
  // A position holder belongs under leadership, not in the member list as well.
  const currentMembers = all.filter((p) => !p.moved_to_past_at && !heldBy.has(p.id));
  const past = all.filter((p) => p.moved_to_past_at);

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
          Edit People
        </h1>
        <p className="mt-2 max-w-prose text-ink-body">
          Everyone listed on the public People page. Moving someone to the past
          is something you do deliberately — nothing here changes because a
          school year ended.
        </p>
      </header>

      {/* ------------------------------------------------------------------ */}
      <section className="rule-notebook mt-10 pt-8" aria-labelledby="add">
        <h2 id="add" className="font-heading text-xl font-bold text-ink-strong">
          Add someone
        </h2>
        <div className="mt-5 max-w-2xl rounded-lg border border-border-subtle bg-surface p-5">
          <NewPersonForm />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="mt-12" aria-labelledby="current-leadership">
        <h2 id="current-leadership" className="font-heading text-xl font-bold text-ink-strong">
          Leadership positions
        </h2>
        <p className="mt-1.5 max-w-prose text-sm text-ink-body">
          {positions.length} {positions.length === 1 ? "position" : "positions"},{" "}
          {positions.filter((p) => p.person_id).length} filled. Titles are yours to
          write and there is no limit on how many positions there are. A vacant
          position stays here and is left off the public page.
        </p>
        <LeadershipPositions positions={positions} candidates={candidates} />
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="mt-12" aria-labelledby="leadership-history">
        <h2 id="leadership-history" className="font-heading text-xl font-bold text-ink-strong">
          Leadership history
        </h2>
        <p className="mt-1.5 max-w-prose text-sm text-ink-body">
          Every appointment that has ended, recorded automatically when a
          position changes hands or is vacated. It cannot be edited from here.
        </p>
        {history.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-border-subtle p-8 text-center text-sm text-ink-muted">
            No appointments have ended yet.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline gap-x-3 px-4 py-3">
                <span className="font-ui text-sm font-semibold text-ink-strong">
                  {h.full_name}
                </span>
                <span className="font-ui text-sm text-lgs-600">{h.title}</span>
                <span className="font-ui text-xs text-ink-muted">
                  {h.academic_year_label ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="mt-12" aria-labelledby="current-members">
        <h2 id="current-members" className="font-heading text-xl font-bold text-ink-strong">
          Current members
        </h2>
        <p className="mt-1.5 text-sm text-ink-body">
          {currentMembers.length} {currentMembers.length === 1 ? "person" : "people"}.
        </p>
        {currentMembers.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-border-subtle p-8 text-center text-sm text-ink-muted">
            No members have been added yet.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {currentMembers.map((p) => (
              <PersonRow key={p.id} person={p} />
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="mt-12" aria-labelledby="past">
        <h2 id="past" className="font-heading text-xl font-bold text-ink-strong">
          Moved to the past
        </h2>
        <p className="mt-1.5 text-sm text-ink-body">
          {past.length} {past.length === 1 ? "person" : "people"}. These appear on{" "}
          <Link href="/people/past" className="text-lgs-600 underline">
            the public Past Members page
          </Link>
          .
        </p>
        {past.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-border-subtle p-8 text-center text-sm text-ink-muted">
            Nobody has been moved to the past.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {past.map((p) => (
              <PersonRow key={p.id} person={p} />
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="mt-12" aria-labelledby="founders">
        <h2 id="founders" className="font-heading text-xl font-bold text-ink-strong">
          Founders
        </h2>
        <p className="mt-1.5 max-w-prose text-sm text-ink-body">
          Founders are recorded in code and cannot be added, changed or removed
          from here. The database refuses it, not just this page.
        </p>
        {(founders ?? []).length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-border-subtle p-8 text-center text-sm text-ink-muted">
            No founders have been recorded yet.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
            {(founders ?? []).map((f) => (
              <li key={f.id as string} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-ui text-sm font-semibold text-ink-strong">
                    {(f.people as unknown as { full_name: string } | null)?.full_name}
                  </p>
                  <p className="font-ui text-xs text-ink-muted">
                    {[f.role_title, f.year].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-sunken px-2.5 py-0.5 font-ui text-xs font-medium text-ink-muted">
                  Read only
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
