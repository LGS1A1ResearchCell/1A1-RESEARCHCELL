import { getSiteContent, settled } from "@/lib/content/site-content";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Resources" };

const CATEGORY: Record<string, { label: string; blurb: string }> = {
  guide: { label: "Guides", blurb: "How research is planned, carried out and submitted." },
  template: { label: "Templates", blurb: "Formatting and structure for submissions." },
  citation: { label: "Citation and referencing", blurb: "How to credit the work you build on." },
  external: { label: "External resources", blurb: "Databases and reading beyond the school." },
  document: { label: "Research Cell documents", blurb: "Official documents of the Research Cell." },
  faq: { label: "Frequently asked questions", blurb: "Questions members ask most often." },
};

const ORDER = ["guide", "template", "citation", "external", "document", "faq"];

/**
 * The public Resources page.
 *
 * resources_public_read limits rows to is_published, so a resource the school
 * has not finished writing is invisible here whatever this page asks for.
 * Nothing is invented: the seeded rows carry visible placeholders and stay
 * unpublished until the school supplies real wording.
 */
export default async function ResourcesPage() {
  const supabase = await createClient();
  const [{ data: resources }, content] = await Promise.all([
    supabase
      .from("resources")
      .select("id, category, title, slug, description, body, external_url, display_order")
      .order("display_order"),
    getSiteContent(),
  ]);

  const list = resources ?? [];
  const intro = settled(content["resources.introduction"]);
  const grouped = ORDER.map((c) => ({
    key: c,
    meta: CATEGORY[c],
    items: list.filter((r) => r.category === c),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="rule-notebook pt-8">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">Resources</h1>
        {intro && (
          <p className="mt-4 max-w-prose text-lg text-ink-body">{intro}</p>
        )}
      </header>

      {list.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-border-subtle bg-surface-muted p-10">
          <h2 className="font-heading text-lg font-bold text-ink-strong">
            Nothing published yet
          </h2>
        </div>
      ) : (
        <div className="mt-12 space-y-14">
          {grouped.map((g) => (
            <section key={g.key} aria-labelledby={`cat-${g.key}`}>
              <h2
                id={`cat-${g.key}`}
                className="font-heading text-2xl font-bold text-ink-strong"
              >
                {g.meta.label}
              </h2>
              <p className="mt-1.5 max-w-prose text-sm text-ink-muted">{g.meta.blurb}</p>

              <ul className="mt-6 grid gap-5 sm:grid-cols-2">
                {g.items.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-border-subtle bg-surface p-5"
                  >
                    <h3 className="font-heading text-lg font-bold text-ink-strong">
                      {r.title}
                    </h3>
                    {r.description && (
                      <p className="mt-2 text-sm leading-relaxed text-ink-body">
                        {r.description}
                      </p>
                    )}
                    {r.body && (
                      <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-body">
                        {r.body}
                      </p>
                    )}
                    {r.external_url && (
                      /* rel="noreferrer noopener" because these links are
                         school-supplied but point off-site. */
                      <a
                        href={r.external_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-4 inline-block font-ui text-sm font-semibold text-lgs-600 underline"
                      >
                        Open resource
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
