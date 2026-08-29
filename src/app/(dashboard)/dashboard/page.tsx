import { redirect } from "next/navigation";

import { requireActiveAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

/**
 * Student dashboard.
 *
 * Phase 2 establishes that the right person reaches this page with the right
 * session. The panels it will carry -- drafts, under review, revision required,
 * published, activity, notifications -- are built in the research phase.
 */
export default async function DashboardPage() {
  const ctx = await requireActiveAccount();

  // Leadership landing here is harmless but pointless; send them to their own
  // area rather than showing an empty student dashboard.
  if (ctx.isLeadership) redirect("/admin");

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("people")
    .select("full_name, class_section, year_joined")
    .eq("id", ctx.personId!)
    .maybeSingle();

  const firstName = person?.full_name?.split(" ")[0] ?? "there";

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
          Welcome, {firstName}
        </h1>
        <p className="mt-2 text-ink-body">
          {person?.class_section && person?.year_joined
            ? `Class ${person.class_section} · Joined the Research Cell in ${person.year_joined}`
            : "Research Cell member"}
        </p>
      </header>

      {/* One-time explanation of how submission works. Shown until the student
          dismisses it, which is recorded on profiles.onboarded_at in the
          research phase when submission actually exists. */}
      <section className="rule-notebook mt-10 pt-8">
        <h2 className="font-heading text-xl font-bold text-ink-strong">
          How submitting research works
        </h2>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-ink-body">
          <li>Individual research can be submitted directly.</li>
          <li>
            For team research, the student who starts the submission becomes the
            Team Leader.
          </li>
          <li>The Team Leader adds the other authors.</li>
          <li>
            Every author must confirm their authorship before the paper can go to
            review.
          </li>
        </ul>
      </section>

      <section className="mt-10 grid gap-px overflow-hidden rounded-lg bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Drafts", "Work you have not yet submitted."],
          ["Under review", "Submitted and with the Research Cell."],
          ["Revision required", "Feedback for you to address."],
          ["Published", "Included in a published journal."],
        ].map(([title, body]) => (
          <div key={title} className="bg-surface p-5">
            <h3 className="font-ui text-sm font-semibold text-ink-strong">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            <p className="mt-3 font-heading text-2xl font-bold text-ink-muted">—</p>
          </div>
        ))}
      </section>

      <p className="mt-8 rounded border border-border-subtle bg-surface p-4 font-ui text-sm text-ink-body">
        Research submission is built in the next phase. Your account is active
        and ready.
      </p>
    </>
  );
}
