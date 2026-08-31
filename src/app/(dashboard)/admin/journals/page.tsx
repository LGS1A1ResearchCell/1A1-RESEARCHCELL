import Link from "next/link";

import { CreateJournalForm } from "@/components/journals/CreateJournalForm";
import { requireLeadership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Journals" };

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-surface-sunken text-ink-muted" },
  pending_admin_approval: { label: "Awaiting school approval", tone: "bg-cell-coral/10 text-cell-coral-text" },
  published: { label: "Published", tone: "bg-lgs-200 text-lgs-800" },
};

export default async function AdminJournalsPage() {
  await requireLeadership();
  const supabase = await createClient();

  const [{ data: journals }, { data: years }] = await Promise.all([
    supabase
      .from("journals")
      .select("id, title, volume_label, status, published_at, academic_years(label), journal_papers(project_id)")
      .order("created_at", { ascending: false }),
    supabase.from("academic_years").select("id, label, is_current").order("label", { ascending: false }),
  ]);

  // A year that already holds a journal cannot take another; offering it would
  // only produce a failure the moment the form is submitted.
  const taken = new Set(
    (journals ?? []).map((j) => (j.academic_years as unknown as { label: string } | null)?.label),
  );
  const availableYears = (years ?? []).filter((y) => !taken.has(y.label));

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">Journals</h1>
        <p className="mt-2 max-w-prose text-ink-body">
          One journal per academic year. Research Cell leadership builds a journal
          and submits it; school administration approves and publishes it.
        </p>
      </header>

      <section className="rule-notebook mt-10 pt-8">
        <h2 className="font-heading text-xl font-bold text-ink-strong">
          All journals{" "}
          <span className="font-ui text-base font-normal text-ink-muted">
            ({(journals ?? []).length})
          </span>
        </h2>

        {(journals ?? []).length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border-subtle bg-surface p-8 text-center text-sm text-ink-muted">
            No journals yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
            {(journals ?? []).map((j) => {
              const s = STATUS[j.status] ?? { label: j.status, tone: "bg-surface-sunken text-ink-muted" };
              const papers = (j.journal_papers ?? []).length;
              return (
                <li key={j.id}>
                  <Link href={`/admin/journals/${j.id}`} className="block p-4 transition-colors hover:bg-lgs-50">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-heading text-base font-bold text-ink-strong">{j.title}</h3>
                        <p className="mt-1 font-ui text-xs text-ink-muted">
                          {[
                            (j.academic_years as unknown as { label: string } | null)?.label,
                            `${papers} ${papers === 1 ? "paper" : "papers"}`,
                            j.published_at
                              ? `Published ${new Date(j.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                              : null,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-ui text-xs font-medium ${s.tone}`}>
                        {s.label}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-xl font-bold text-ink-strong">Start a new journal</h2>
        <div className="mt-4">
          <CreateJournalForm years={availableYears} />
        </div>
      </section>
    </>
  );
}
