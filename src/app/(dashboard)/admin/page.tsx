import Link from "next/link";

import { requireLeadership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin" };

/**
 * The landing page for everyone who can reach the admin area.
 *
 * Two roles arrive here and they are not the same thing, so the page says which
 * one you are and offers only what that role can actually use. School
 * Administration is a superset of leadership — mirroring is_leadership() in the
 * database, which is true for school administrators — but the extra functions
 * are theirs alone and are listed separately rather than blended in.
 *
 * Nothing here grants anything. Every destination re-checks the caller through
 * requireSchoolAdmin() or requireLeadership(), and the database checks again
 * underneath that. Hiding a card is presentation, not permission.
 */

type Card = { href: string; title: string; description: string };

/** Available to Research Cell leadership and to School Administration. */
const EDITORIAL: Card[] = [
  {
    href: "/admin/review",
    title: "Review research",
    description: "Read submissions and record a decision: revision required, or approved.",
  },
  {
    href: "/admin/journals",
    title: "Journals",
    description: "Assemble each year's journal from approved papers and submit it for approval.",
  },
];

/** School Administration only. */
const ADMINISTRATIVE: Card[] = [
  {
    href: "/admin/people",
    title: "People",
    description: "Account status, permissions, leadership for the year, and profile visibility.",
  },
  {
    href: "/admin/content",
    title: "Site content",
    description: "The wording on the public site, including the tagline. Takes effect immediately.",
  },
  {
    href: "/admin/announcements",
    title: "Announcements",
    description: "Notices for the public site, shown between the dates you set.",
  },
  {
    href: "/admin/resources",
    title: "Resources",
    description: "Guidance and templates. Each stays a draft until you publish it.",
  },
  {
    href: "/admin/activity",
    title: "Activity log",
    description: "The permanent record of administrative and editorial actions.",
  },
];

function CardLink({ card }: { card: Card }) {
  return (
    <Link
      href={card.href}
      className="rounded-lg border border-border-subtle bg-surface p-5 transition-colors hover:border-lgs-500"
    >
      <h3 className="font-ui text-sm font-semibold text-ink-strong">{card.title}</h3>
      <p className="mt-1.5 text-sm text-ink-muted">{card.description}</p>
    </Link>
  );
}

export default async function AdminOverviewPage() {
  const ctx = await requireLeadership();
  const supabase = await createClient();

  // Only School Administration can read account_requests, so leadership gets
  // null here — from RLS, not from a conditional in this file.
  const { count: pendingCount } = await supabase
    .from("account_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
          {ctx.isSchoolAdmin ? "School administration" : "Research Cell administration"}
        </h1>
        <p className="mt-2 max-w-prose text-ink-body">
          {ctx.isSchoolAdmin
            ? "You have School Administration access: the Research Cell's editorial work, and the functions that belong to the school alone."
            : "Research Cell Leadership — Head or Deputy Head of Research."}
        </p>
      </header>

      <section className="rule-notebook mt-10 pt-8" aria-labelledby="editorial">
        <h2 id="editorial" className="font-heading text-xl font-bold text-ink-strong">
          Research and journals
        </h2>
        <p className="mt-1.5 max-w-prose text-sm text-ink-body">
          {ctx.isSchoolAdmin
            ? "Shared with Research Cell leadership. Approving and publishing a journal is yours alone."
            : "The editorial work of the Research Cell."}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {EDITORIAL.map((c) => (
            <CardLink key={c.href} card={c} />
          ))}
        </div>
      </section>

      {ctx.isSchoolAdmin ? (
        <section className="mt-12" aria-labelledby="administrative">
          <h2 id="administrative" className="font-heading text-xl font-bold text-ink-strong">
            School Administration only
          </h2>
          <p className="mt-1.5 max-w-prose text-sm text-ink-body">
            Research Cell leadership cannot reach any of these.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Link
              href="/admin/accounts"
              className="rounded-lg border border-border-subtle bg-surface p-5 transition-colors hover:border-lgs-500"
            >
              <h3 className="font-ui text-sm font-semibold text-ink-strong">
                New Student Accounts
              </h3>
              <p className="mt-1.5 text-sm text-ink-muted">
                Review and approve student registrations.
              </p>
              <p className="mt-3 font-heading text-2xl font-bold text-lgs-600">
                {pendingCount ?? 0}
                <span className="ml-2 font-ui text-sm font-normal text-ink-muted">
                  awaiting review
                </span>
              </p>
            </Link>

            {ADMINISTRATIVE.map((c) => (
              <CardLink key={c.href} card={c} />
            ))}
          </div>
        </section>
      ) : (
        <p className="mt-8 max-w-prose rounded border border-border-subtle bg-surface p-4 text-sm leading-relaxed text-ink-body">
          Account approval, suspension, permission changes, journal publication
          and site content are School Administration functions, and are not
          available to Research Cell leadership.
        </p>
      )}
    </>
  );
}
