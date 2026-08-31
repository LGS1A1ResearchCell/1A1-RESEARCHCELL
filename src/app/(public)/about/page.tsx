import Link from "next/link";

import { getSiteContent, settled } from "@/lib/content/site-content";

export const metadata = { title: "About" };

/**
 * About the Research Cell.
 *
 * Body, mission and contact all come from the editable site_content table.
 * Where the school has not supplied wording, the section is omitted rather
 * than showing a placeholder to a visitor — a blank space is honest; invented
 * copy is not.
 */
export default async function AboutPage() {
  const c = await getSiteContent();
  const body = settled(c["about.body"]);
  const mission = settled(c["about.mission"]);
  const contact = settled(c["contact.email"]);
  const nothingYet = !body && !mission && !contact;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="rule-notebook pt-8">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">About</h1>
        <p className="mt-4 max-w-prose text-lg text-ink-body">
          The 1A1 Research Cell is a student research body of Lahore Grammar
          School, 1-A-1 branch, Lahore.
        </p>
      </header>

      {mission && (
        <section className="mt-12 max-w-prose" aria-labelledby="mission">
          <h2 id="mission" className="font-heading text-2xl font-bold text-ink-strong">
            Our mission
          </h2>
          <p className="mt-4 leading-relaxed whitespace-pre-wrap text-ink-body">{mission}</p>
        </section>
      )}

      {body && (
        <section className="mt-12 max-w-prose" aria-labelledby="about-body">
          <h2 id="about-body" className="font-heading text-2xl font-bold text-ink-strong">
            The Research Cell
          </h2>
          <p className="mt-4 leading-relaxed whitespace-pre-wrap text-ink-body">{body}</p>
        </section>
      )}

      {nothingYet && (
        <p className="mt-12 rounded-lg border border-dashed border-border-subtle bg-surface-muted p-8 text-sm text-ink-muted">
          The Research Cell&rsquo;s own description of itself is still being
          written. In the meantime, the archive speaks for it:{" "}
          <Link href="/journals" className="text-lgs-600 underline">
            browse the journals
          </Link>{" "}
          or{" "}
          <Link href="/research" className="text-lgs-600 underline">
            read the published research
          </Link>
          .
        </p>
      )}

      <section className="mt-16" aria-labelledby="explore">
        <h2 id="explore" className="font-heading text-2xl font-bold text-ink-strong">
          Explore the archive
        </h2>
        <div className="mt-6 grid gap-px overflow-hidden rounded-lg bg-border-subtle sm:grid-cols-3">
          {[
            { href: "/journals", title: "Journals", body: "One issue per academic year." },
            { href: "/research", title: "Research", body: "Every published paper." },
            { href: "/people", title: "People", body: "Founders, leadership and researchers." },
          ].map((card) => (
            <Link key={card.href} href={card.href} className="bg-surface p-6 transition-colors hover:bg-lgs-50">
              <h3 className="font-heading text-lg font-bold text-ink-strong">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-body">{card.body}</p>
            </Link>
          ))}
        </div>
      </section>

      {contact && (
        <section className="mt-16 max-w-prose" aria-labelledby="contact">
          <h2 id="contact" className="font-heading text-2xl font-bold text-ink-strong">
            Contact
          </h2>
          <p className="mt-4 text-ink-body">{contact}</p>
        </section>
      )}
    </div>
  );
}
