import Link from "next/link";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Journals" };

/**
 * The public journal archive.
 *
 * Read anonymously. journals_public_read limits the rows to status =
 * 'published', so an unpublished or pending issue cannot appear here whatever
 * this page asks for.
 */
export default async function JournalsPage() {
  const supabase = await createClient();

  const { data: journals } = await supabase
    .from("journals")
    .select(
      "id, title, volume_label, slug, description, cover_path, pdf_path, published_at, academic_years(label)",
    )
    .order("published_at", { ascending: false });

  const list = journals ?? [];

  // Paper counts come from the published-contents view, which is itself limited
  // to published journals.
  const { data: contents } = await supabase
    .from("published_journal_papers")
    .select("journal_id");
  const counts = new Map<string, number>();
  for (const row of contents ?? []) {
    counts.set(row.journal_id, (counts.get(row.journal_id) ?? 0) + 1);
  }

  const coverUrl = (path: string | null) =>
    path ? `${env.supabaseUrl}/storage/v1/object/public/journal-covers/${path}` : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="rule-notebook pt-8">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">Journals</h1>
        <p className="mt-4 max-w-prose text-lg text-ink-body">
          The annual journal of the 1A1 Research Cell, one issue per academic
          year.
        </p>
      </header>

      {list.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-border-subtle bg-surface-muted p-10 text-center text-sm text-ink-muted">
          No journals have been published yet.
        </p>
      ) : (
        <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((j) => {
            const url = coverUrl(j.cover_path);
            const papers = counts.get(j.id) ?? 0;
            const year = (j.academic_years as unknown as { label: string } | null)?.label;
            return (
              <li key={j.id}>
                <Link
                  href={`/journals/${j.slug}`}
                  className="block h-full overflow-hidden rounded-lg border border-border-subtle bg-surface transition-colors hover:border-lgs-500"
                >
                  <div className="flex aspect-[3/4] items-center justify-center bg-cell-ink">
                    {url ? (
                      /* The storage host is not registered with the image
                         optimiser, and registering it would tie every cover to
                         whichever Supabase project the school later owns. */
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={`Cover of ${j.title}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="p-6 text-center">
                        <p className="font-ui text-xs tracking-[0.2em] text-cell-cyan uppercase">
                          1A1 Research Cell
                        </p>
                        <p className="mt-3 font-heading text-2xl font-extrabold text-white">
                          {j.title}
                        </p>
                        {year && (
                          <p className="mt-2 font-ui text-xs text-white/60">{year}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <h2 className="font-heading text-lg font-bold text-ink-strong">
                      {j.title}
                    </h2>
                    <p className="mt-1 font-ui text-xs text-ink-muted">
                      {[
                        year,
                        `${papers} ${papers === 1 ? "paper" : "papers"}`,
                        j.published_at
                          ? new Date(j.published_at).toLocaleDateString("en-GB", {
                              month: "long",
                              year: "numeric",
                            })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {j.description && (
                      <p className="mt-3 text-sm leading-relaxed text-ink-body">
                        {j.description}
                      </p>
                    )}
                    <span className="mt-4 inline-block font-ui text-sm font-medium text-lgs-600">
                      Read this issue
                      <span aria-hidden="true" className="ml-1">
                        &rarr;
                      </span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
