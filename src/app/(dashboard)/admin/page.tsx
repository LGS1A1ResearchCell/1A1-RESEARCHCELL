import Link from "next/link";

import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Management area" };

/**
 * The CMS landing page.
 *
 * One shared password means one kind of visitor, so this no longer sorts
 * anything by role. It lists the seven sections the school approved and how
 * much is in each, so the first screen answers "what is here?" rather than
 * making someone open every section to find out.
 *
 * Every card links to a page that exists. Nothing here is a placeholder for
 * work that has not been done.
 */

type Card = {
  href: string;
  title: string;
  description: string;
  count?: number | null;
  countLabel?: string;
};

function SectionCard({ card }: { card: Card }) {
  return (
    <Link
      href={card.href}
      className="rounded-lg border border-border-subtle bg-surface p-5 transition-colors hover:border-lgs-500"
    >
      <h3 className="font-ui text-sm font-semibold text-ink-strong">{card.title}</h3>
      <p className="mt-1.5 text-sm text-ink-muted">{card.description}</p>
      {card.count !== undefined && card.count !== null && (
        <p className="mt-3 font-heading text-2xl font-bold text-lgs-600">
          {card.count}
          <span className="ml-2 font-ui text-sm font-normal text-ink-muted">
            {card.countLabel}
          </span>
        </p>
      )}
    </Link>
  );
}

export default async function CmsOverviewPage() {
  await requireSchoolAdmin();
  const supabase = await createClient();

  // Counts come back through the same policies as every other read, so a number
  // shown here is a number this session is genuinely allowed to see.
  const head = { count: "exact" as const, head: true };
  const results = await Promise.all([
    supabase.from("research_projects").select("id", head).eq("status", "published"),
    supabase.from("research_projects").select("id", head).neq("status", "published"),
    supabase.from("journals").select("id", head),
    supabase.from("people").select("id", head),
    supabase.from("resources").select("id", head),
    supabase.from("announcements").select("id", head),
    supabase.from("site_content").select("key", head),
  ]);
  const [published, drafts, journals, people, resources, announcements, content] =
    results.map((r) => r.count ?? 0);

  const sections: Card[] = [
    {
      href: "/admin/research",
      title: "Research",
      description: "Papers published in a journal and visible in the public archive.",
      count: published,
      countLabel: published === 1 ? "paper" : "papers",
    },
    {
      href: "/admin/drafts",
      title: "Drafts",
      description: "Research not yet published. None of it is visible publicly.",
      count: drafts,
      countLabel: drafts === 1 ? "paper" : "papers",
    },
    {
      href: "/admin/journals",
      title: "Journals",
      description: "Assemble each year's journal and publish it.",
      count: journals,
      countLabel: journals === 1 ? "journal" : "journals",
    },
    {
      href: "/admin/people",
      title: "People",
      description: "Who appears on the public People page, and who does not.",
      count: people,
      countLabel: "on record",
    },
    {
      href: "/admin/resources",
      title: "Resources",
      description: "Guidance and templates. Each stays a draft until published.",
      count: resources,
      countLabel: resources === 1 ? "resource" : "resources",
    },
    {
      href: "/admin/announcements",
      title: "Announcements",
      description: "Notices for the public site, shown between the dates you set.",
      count: announcements,
      countLabel: announcements === 1 ? "announcement" : "announcements",
    },
    {
      href: "/admin/content",
      title: "Site content",
      description: "The wording on the public site. Changes take effect immediately.",
      count: content,
      countLabel: "entries",
    },
  ];

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
          Management area
        </h1>
        <p className="mt-2 max-w-prose text-ink-body">
          Everything here edits the public site. Changes are live as soon as they
          are saved.
        </p>
      </header>

      <section className="rule-notebook mt-10 pt-8" aria-labelledby="sections">
        <h2 id="sections" className="sr-only">
          Sections
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((c) => (
            <SectionCard key={c.href} card={c} />
          ))}
        </div>
      </section>
    </>
  );
}
