import Link from "next/link";

import { StatusBadge } from "@/components/research/StatusBadge";

export type ResearchRow = {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  research_type: string | null;
  authorship_mode: string | null;
  team_name: string | null;
  research_area: string | null;
  supervisor: string | null;
  pdf_path: string | null;
  updated_at: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  primary: "Primary Research",
  secondary: "Secondary Research",
  independent: "Independent Research",
};

/**
 * The list of research shown in the CMS, used by both the Research and Drafts
 * sections — they differ only in which rows they are given.
 *
 * Every title is a link to its editor. A list of things you cannot open is the
 * bug this project has already had once.
 */
export function ResearchList({
  rows,
  empty,
}: {
  rows: ResearchRow[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-8 rounded-lg border border-dashed border-border-subtle bg-surface p-10 text-center text-sm text-ink-muted">
        {empty}
      </p>
    );
  }

  return (
    <ul className="mt-8 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/admin/research/${r.id}`}
            className="flex flex-wrap items-start justify-between gap-3 p-4 transition-colors hover:bg-lgs-50"
          >
            <div className="min-w-0">
              <h3 className="font-heading text-base font-bold text-ink-strong">
                {r.title}
              </h3>
              <p className="mt-1 font-ui text-xs text-ink-muted">
                {[
                  r.research_type ? TYPE_LABEL[r.research_type] ?? r.research_type : null,
                  r.authorship_mode === "team" ? "Team research" : null,
                  r.research_area,
                  r.team_name,
                  r.supervisor ? `Supervised by ${r.supervisor}` : null,
                  r.pdf_path ? "PDF attached" : "No PDF",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <StatusBadge status={r.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
