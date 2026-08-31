import Image from "next/image";
import Link from "next/link";

import researchCellLogo from "@/../public/brand/research-cell-logo.jpg";
import {
  getActiveAnnouncements,
  getSiteContent,
  settled,
} from "@/lib/content/site-content";

/**
 * Homepage.
 *
 * Every string below comes from the editable site_content table, so the school
 * can change its own wording without a redeployment.
 *
 * The tagline is NOT hard-coded, and is omitted entirely rather than guessed
 * at while it remains a placeholder: whether the Research Cell describes itself
 * as scientific or as spanning all disciplines is still an open question, and
 * printing either would settle it by accident.
 */
export default async function HomePage() {
  const [c, announcements] = await Promise.all([
    getSiteContent(),
    getActiveAnnouncements(),
  ]);

  const content = {
    heroHeading: settled(c["home.hero_heading"]) ?? "1A1 Research Cell",
    tagline: settled(c["site.tagline"]),
    introduction:
      settled(c["home.introduction"]) ??
      "The research archive and publication platform of the 1A1 Research Cell at Lahore Grammar School, 1-A-1 branch.",
  };

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="on-ink relative overflow-hidden bg-cell-ink text-white">
        {/* Ruled-paper motif: widely spaced hairlines, barely visible. The
            archive reference the brief asks for, without illustration. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, transparent 0 31px, white 31px 32px)",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.35fr_1fr]">
            <div>
              <p className="font-ui text-xs font-medium tracking-[0.2em] text-cell-cyan uppercase">
                Lahore Grammar School &middot; 1-A-1
              </p>

              <h1 className="mt-5 font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                {content.heroHeading}
              </h1>

              {content.tagline ? (
                <p className="mt-4 font-heading text-xl text-cell-cyan sm:text-2xl">
                  {content.tagline}
                </p>
              ) : (
                <p className="mt-4 font-ui text-sm text-white/45 italic">
                  Tagline to be confirmed by the school.
                </p>
              )}

              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
                {content.introduction}
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                {/* White ground with navy text rather than white-on-accent:
                    white on #149ddd measures 3.04:1, which fails AA for text
                    this size. On a navy hero a white button is also the
                    stronger focal point. */}
                <Link
                  href="/research"
                  className="rounded bg-white px-5 py-3 font-ui text-sm font-semibold text-lgs-700 transition-colors hover:bg-lgs-100"
                >
                  Browse Research
                </Link>
                <Link
                  href="/journals"
                  className="rounded border border-white/25 px-5 py-3 font-ui text-sm font-semibold text-white transition-colors hover:border-white/50 hover:bg-white/5"
                >
                  Journal Archive
                </Link>
              </div>
            </div>

            {/* The logo at display size, on the ground it was designed for. */}
            <div className="hidden justify-self-center lg:block">
              <Image
                src={researchCellLogo}
                alt="The 1A1 Research Cell emblem"
                width={300}
                height={300}
                priority
                className="rounded-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Announcements                                                     */}
      {/* ---------------------------------------------------------------- */}
      {/* The read policy enforces the date window, so an announcement stops
          appearing on its end date without any scheduled job. */}
      {announcements.length > 0 && (
        <section
          aria-labelledby="announcements"
          className="mx-auto max-w-6xl px-4 pt-12 sm:px-6"
        >
          <h2 id="announcements" className="sr-only">
            Announcements
          </h2>
          <ul className="space-y-3">
            {announcements.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-lgs-200 bg-lgs-50 p-5"
              >
                <h3 className="font-heading text-lg font-bold text-ink-strong">
                  {a.title}
                </h3>
                {a.body && (
                  <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-body">
                    {a.body}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Sections                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="rule-notebook pt-8">
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">
            The Archive
          </h2>
          <p className="mt-3 max-w-prose text-ink-body">
            Research published by the Research Cell, organised by academic year
            and collected into an annual journal.
          </p>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-lg bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: "/research",
              title: "Research",
              body: "Published papers, filterable by year, subject, type and author.",
            },
            {
              href: "/journals",
              title: "Journals",
              body: "The annual journal of the Research Cell, issue by issue.",
            },
            {
              href: "/people",
              title: "People",
              body: "Founders, current leadership and the researchers behind the work.",
            },
            {
              href: "/resources",
              title: "Resources",
              body: "Guidance, templates and referencing help for Research Cell members.",
            },
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group bg-surface p-6 transition-colors hover:bg-lgs-50"
            >
              <h3 className="font-heading text-lg font-bold text-ink-strong">
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-body">
                {card.body}
              </p>
              <span className="mt-4 inline-block font-ui text-sm font-medium text-lgs-600">
                View
                <span aria-hidden="true" className="ml-1">
                  &rarr;
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Development notice                                                */}
      {/* ---------------------------------------------------------------- */}
      {/* Present so a development instance can never be mistaken for the
          school's live site. Removed when the school approves publication. */}
      <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
        <div className="rounded border border-cell-coral/30 bg-cell-coral/5 p-4">
          <p className="font-ui text-sm text-ink-body">
            <span className="font-semibold text-ink-strong">
              Development preview.
            </span>{" "}
            Content on this page is placeholder text awaiting approved wording.
            Leadership, research and journal sections are connected to live data
            in later phases.
          </p>
        </div>
      </section>
    </>
  );
}
