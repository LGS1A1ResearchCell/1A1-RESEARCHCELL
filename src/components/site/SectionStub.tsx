/**
 * Placeholder for a public section not yet connected to data.
 *
 * Exists so the navigation is complete and walkable from Phase 1 onward, and so
 * that an unfinished section is unmistakably unfinished rather than looking
 * like an empty archive.
 */
export function SectionStub({
  title,
  intro,
  arriving,
}: {
  title: string;
  intro: string;
  arriving: string;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="rule-notebook pt-8">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-prose text-lg text-ink-body">{intro}</p>
      </div>

      <div className="mt-10 rounded-lg border border-dashed border-border-subtle bg-surface-muted p-8">
        <h2 className="font-ui text-sm font-semibold tracking-wide text-ink-strong uppercase">
          Not yet available
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink-body">{arriving}</p>
      </div>
    </div>
  );
}
