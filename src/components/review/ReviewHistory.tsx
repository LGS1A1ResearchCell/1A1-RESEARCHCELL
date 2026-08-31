/**
 * The permanent review record: version, date, reviewer, decision, feedback.
 *
 * Shown identically to the authors and to leadership. The rows come from the
 * research_review_history view, whose visibility is decided by Row Level
 * Security on `reviews` — an author sees their own work's reviews, leadership
 * sees all, an anonymous visitor sees none. This component does no filtering of
 * its own, because it must not be what stands between a student and someone
 * else's feedback.
 */

export type ReviewEntry = {
  review_id: string;
  version_number: number;
  document_filename: string | null;
  decision: string;
  feedback: string | null;
  reviewed_at: string;
  reviewer_name: string | null;
};

export function ReviewHistory({
  entries,
  emptyMessage = "This submission has not been reviewed yet.",
}: {
  entries: ReviewEntry[];
  emptyMessage?: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border-subtle bg-surface p-6 text-center text-sm text-ink-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {[...entries]
        .sort((a, b) => b.version_number - a.version_number)
        .map((e) => {
          const approved = e.decision === "approved";
          return (
            <li
              key={e.review_id}
              className={`rounded-lg border bg-surface p-5 ${
                approved ? "border-lgs-200" : "border-cell-coral/40"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="font-ui text-sm font-semibold text-ink-strong">
                  Version {e.version_number}
                  {e.document_filename && (
                    <span className="ml-2 font-normal break-all text-ink-muted">
                      {e.document_filename}
                    </span>
                  )}
                </h3>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 font-ui text-xs font-medium ${
                    approved
                      ? "bg-lgs-100 text-lgs-700"
                      : "bg-cell-coral/10 text-cell-coral-text"
                  }`}
                >
                  {approved ? "Approved" : "Revision required"}
                </span>
              </div>

              <p className="mt-1 font-ui text-xs text-ink-muted">
                {e.reviewer_name ?? "Research Cell"} ·{" "}
                {new Date(e.reviewed_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>

              {e.feedback && (
                <div className="mt-3 border-l-2 border-border-subtle pl-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-body">
                    {e.feedback}
                  </p>
                </div>
              )}
            </li>
          );
        })}
    </ol>
  );
}
