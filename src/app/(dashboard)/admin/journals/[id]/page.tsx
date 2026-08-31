import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AssetUpload,
  CorrectionsPanel,
  JournalDetailsForm,
  MastheadManager,
  PaperManager,
  WorkflowPanel,
  type Candidate,
  type Correction,
  type Credit,
  type JournalPaper,
} from "@/components/journals/JournalBuilder";
import { requireLeadership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Journal builder" };

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-surface-sunken text-ink-muted" },
  pending_admin_approval: { label: "Awaiting school approval", tone: "bg-cell-coral/10 text-cell-coral" },
  published: { label: "Published", tone: "bg-lgs-200 text-lgs-800" },
};

export default async function JournalBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireLeadership();
  const supabase = await createClient();

  const { data: journal } = await supabase
    .from("journals")
    .select("id, title, volume_label, description, status, cover_path, pdf_path, published_at, academic_years(label)")
    .eq("id", id)
    .maybeSingle();

  if (!journal) notFound();

  const locked = journal.status === "published";

  const [{ data: paperRows }, { data: creditRows }, { data: corrections }] = await Promise.all([
    supabase
      .from("journal_papers")
      .select("project_id, display_order, start_page, end_page, research_projects(title, research_authors(author_order, people(full_name)))")
      .eq("journal_id", id)
      .order("display_order"),
    supabase
      .from("journal_credits")
      .select("id, person_id, credit_title, display_order, people(full_name)")
      .eq("journal_id", id)
      .order("display_order"),
    supabase
      .from("journal_corrections")
      .select("id, description, approved_at, created_at")
      .eq("journal_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const namesOf = (rp: unknown) =>
    ((rp as { research_authors?: { author_order: number; people: { full_name: string } | null }[] } | null)
      ?.research_authors ?? [])
      .slice()
      .sort((a, b) => a.author_order - b.author_order)
      .map((a) => a.people?.full_name)
      .filter(Boolean)
      .join(", ");

  const papers: JournalPaper[] = (paperRows ?? []).map((p) => ({
    project_id: p.project_id,
    title: (p.research_projects as unknown as { title: string } | null)?.title ?? "Untitled",
    display_order: p.display_order,
    start_page: p.start_page,
    end_page: p.end_page,
    authors: namesOf(p.research_projects),
  }));

  const credits: Credit[] = (creditRows ?? []).map((c) => ({
    id: c.id,
    person_id: c.person_id,
    credit_title: c.credit_title,
    full_name: (c.people as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
  }));

  // Approved research not yet placed in any journal. A paper belongs to one
  // issue, so anything already placed is excluded by the query below.
  let candidates: Candidate[] = [];
  let members: { id: string; full_name: string }[] = [];

  if (!locked) {
    const [{ data: placed }, { data: approved }, { data: people }] = await Promise.all([
      supabase.from("journal_papers").select("project_id"),
      supabase
        .from("research_projects")
        .select("id, title, research_authors(author_order, people(full_name))")
        .eq("status", "approved")
        .order("title"),
      supabase.from("people").select("id, full_name").order("full_name"),
    ]);

    const used = new Set((placed ?? []).map((p) => p.project_id));
    candidates = (approved ?? [])
      .filter((p) => !used.has(p.id))
      .map((p) => ({ id: p.id, title: p.title, authors: namesOf(p) }));
    members = (people ?? []).map((p) => ({ id: p.id, full_name: p.full_name }));
  }

  const s = STATUS[journal.status] ?? { label: journal.status, tone: "bg-surface-sunken text-ink-muted" };

  return (
    <>
      <header>
        <p className="font-ui text-sm text-ink-muted">
          <Link href="/admin/journals" className="text-lgs-600 underline">Journals</Link>
          {" / "}Builder
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-heading text-2xl font-extrabold text-ink-strong sm:text-3xl">
            {journal.title}
          </h1>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-ui text-xs font-medium ${s.tone}`}>
            {s.label}
          </span>
        </div>
        <p className="mt-2 font-ui text-sm text-ink-muted">
          {[
            (journal.academic_years as unknown as { label: string } | null)?.label,
            journal.volume_label ? `Volume ${journal.volume_label}` : null,
            `${papers.length} ${papers.length === 1 ? "paper" : "papers"}`,
          ].filter(Boolean).join(" · ")}
        </p>
      </header>

      <section className="rule-notebook mt-10 pt-8">
        <WorkflowPanel
          journalId={id}
          status={journal.status}
          paperCount={papers.length}
          isSchoolAdmin={ctx.isSchoolAdmin}
        />
      </section>

      {!locked && (
        <section className="mt-12">
          <h2 className="font-heading text-lg font-bold text-ink-strong">Details</h2>
          <div className="mt-4">
            <JournalDetailsForm
              journalId={id}
              title={journal.title}
              volumeLabel={journal.volume_label ?? ""}
              description={journal.description ?? ""}
              locked={locked}
            />
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="font-heading text-lg font-bold text-ink-strong">
          Contents{" "}
          <span className="font-ui text-sm font-normal text-ink-muted">({papers.length})</span>
        </h2>
        <p className="mt-1.5 max-w-prose text-sm text-ink-body">
          Only research the Research Cell has approved can be included, and a
          paper appears in one journal only.
        </p>
        <div className="mt-4">
          <PaperManager journalId={id} papers={papers} candidates={candidates} locked={locked} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-lg font-bold text-ink-strong">Masthead</h2>
        <div className="mt-4">
          <MastheadManager journalId={id} credits={credits} members={members} locked={locked} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-lg font-bold text-ink-strong">Cover and PDF</h2>
        <div className="mt-4">
          <AssetUpload
            journalId={id}
            hasCover={!!journal.cover_path}
            hasPdf={!!journal.pdf_path}
            locked={locked}
          />
        </div>
      </section>

      {locked && (
        <section className="mt-12">
          <h2 className="font-heading text-lg font-bold text-ink-strong">Corrections</h2>
          <div className="mt-4">
            <CorrectionsPanel
              journalId={id}
              corrections={(corrections ?? []) as Correction[]}
              isSchoolAdmin={ctx.isSchoolAdmin}
            />
          </div>
        </section>
      )}
    </>
  );
}
