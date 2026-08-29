import Link from "next/link";

import { requireLeadership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const ctx = await requireLeadership();
  const supabase = await createClient();

  // Only School Administration can read account_requests, so leadership gets
  // null here -- from RLS, not from a conditional in this file.
  const { count: pendingCount } = await supabase
    .from("account_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
          Research Cell administration
        </h1>
        <p className="mt-2 text-ink-body">
          {ctx.isSchoolAdmin
            ? "School Administration"
            : "Research Cell Leadership — Head or Deputy Head of Research"}
        </p>
      </header>

      <section className="rule-notebook mt-10 pt-8">
        <h2 className="font-heading text-xl font-bold text-ink-strong">
          Available to you
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {ctx.isSchoolAdmin && (
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
          )}

          <div className="rounded-lg border border-dashed border-border-subtle p-5">
            <h3 className="font-ui text-sm font-semibold text-ink-strong">
              Research review
            </h3>
            <p className="mt-1.5 text-sm text-ink-muted">
              Built in the review phase.
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-border-subtle p-5">
            <h3 className="font-ui text-sm font-semibold text-ink-strong">Journals</h3>
            <p className="mt-1.5 text-sm text-ink-muted">
              Built in the journals phase.
            </p>
          </div>
        </div>

        {!ctx.isSchoolAdmin && (
          <p className="mt-6 rounded border border-border-subtle bg-surface p-4 text-sm leading-relaxed text-ink-body">
            Account approval, suspension and permission changes are School
            Administration functions and are not available to Research Cell
            leadership.
          </p>
        )}
      </section>
    </>
  );
}
