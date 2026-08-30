const LABEL: Record<string, { text: string; tone: string }> = {
  draft: { text: "Draft", tone: "bg-surface-sunken text-ink-muted" },
  awaiting_author_confirmation: { text: "Awaiting author confirmation", tone: "bg-cell-coral/10 text-cell-coral" },
  submitted: { text: "Submitted", tone: "bg-lgs-100 text-lgs-700" },
  under_review: { text: "Under review", tone: "bg-lgs-100 text-lgs-700" },
  revision_required: { text: "Revision required", tone: "bg-cell-coral/10 text-cell-coral" },
  approved: { text: "Approved", tone: "bg-lgs-200 text-lgs-800" },
  published: { text: "Published", tone: "bg-lgs-200 text-lgs-800" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = LABEL[status] ?? { text: status, tone: "bg-surface-sunken text-ink-muted" };
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 font-ui text-xs font-medium ${s.tone}`}>
      {s.text}
    </span>
  );
}
