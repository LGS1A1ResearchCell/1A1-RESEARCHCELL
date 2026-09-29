import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Past members" };

/**
 * Past leadership and past members, as tables.
 *
 * Tables rather than cards because these lists grow every year and are read by
 * scanning down a column — a grid of cards stops working at the third cohort.
 *
 * The academic year is printed exactly as it was typed. A member may belong to
 * the Research Cell across two A-Level years, so "2025-27" is a real value and
 * is never split, parsed or recomputed from a date. Sorting is on that string,
 * descending, which puts the most recent years first.
 */

type PastRow = {
  id: string;
  full_name: string;
  status: "student" | "leadership" | null;
  leadership_title: string | null;
  academic_year_text: string | null;
};

const th =
  "px-4 py-3 text-left font-ui text-xs font-semibold tracking-wide text-ink-muted uppercase";
const td = "px-4 py-3 align-top text-sm text-ink-body";

function PeopleTable({
  rows,
  caption,
  withTitle,
}: {
  rows: PastRow[];
  caption: string;
  withTitle: boolean;
}) {
  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-border-subtle bg-surface">
      <table className="w-full min-w-[32rem] border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border-subtle bg-surface-muted">
          <tr>
            <th scope="col" className={th}>
              Name
            </th>
            {withTitle && (
              <th scope="col" className={th}>
                Title
              </th>
            )}
            <th scope="col" className={th}>
              Academic year
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map((p) => (
            <tr key={p.id}>
              <th scope="row" className={`${td} font-ui font-semibold text-ink-strong`}>
                {p.full_name}
              </th>
              {withTitle && <td className={td}>{p.leadership_title ?? "—"}</td>}
              <td className={`${td} whitespace-nowrap`}>{p.academic_year_text ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PastMembersPage() {
  const supabase = await createClient();

  // Ordering is done by the database on the stored string, so what decides the
  // order is exactly what the page displays.
  const { data } = await supabase
    .from("past_people")
    .select("id, full_name, status, leadership_title, academic_year_text")
    .order("academic_year_text", { ascending: false, nullsFirst: false })
    .order("full_name");

  const all = (data ?? []) as PastRow[];
  const pastLeadership = all.filter((p) => p.status === "leadership");
  const pastMembers = all.filter((p) => p.status === "student");

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="font-ui text-sm text-ink-muted">
        <Link href="/people" className="text-lgs-600 underline">
          People
        </Link>
        {" / Past members"}
      </p>

      <header className="rule-notebook mt-4 pt-8">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">Past members</h1>
        <p className="mt-4 max-w-prose text-lg text-ink-body">
          Everyone who has been part of the 1A1 Research Cell in previous years,
          with the leadership of each year. Most recent first.
        </p>
      </header>

      <section className="mt-16" aria-labelledby="past-leadership">
        <h2 id="past-leadership" className="font-heading text-2xl font-bold text-ink-strong">
          Past leadership
        </h2>
        {pastLeadership.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-border-subtle bg-surface-muted p-8 text-center text-sm text-ink-muted">
            No past leadership has been recorded yet.
          </p>
        ) : (
          <PeopleTable
            rows={pastLeadership}
            caption="Past leadership of the Research Cell, most recent academic year first"
            withTitle
          />
        )}
      </section>

      <section className="mt-16" aria-labelledby="past-members">
        <h2 id="past-members" className="font-heading text-2xl font-bold text-ink-strong">
          Past members
        </h2>
        {pastMembers.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-border-subtle bg-surface-muted p-8 text-center text-sm text-ink-muted">
            No past members have been recorded yet.
          </p>
        ) : (
          <PeopleTable
            rows={pastMembers}
            caption="Past members of the Research Cell, most recent academic year first"
            withTitle={false}
          />
        )}
      </section>
    </div>
  );
}
