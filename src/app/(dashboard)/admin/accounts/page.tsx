import {
  AccountRequestCard,
  type PendingRequest,
} from "@/components/admin/AccountRequestCard";
import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "New Student Accounts" };

/**
 * The registration queue.
 *
 * requireSchoolAdmin sends Research Cell leadership away before this renders.
 * That is a courtesy, not the control: account_requests has no policy granting
 * leadership any access, so even a hand-crafted request returns nothing.
 */
export default async function AccountsPage() {
  await requireSchoolAdmin();
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("account_requests")
    .select("id, full_name, email, class_section, year_joined, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const { data: reviewed } = await supabase
    .from("account_requests")
    .select("id, full_name, email, status, reviewed_at, review_note")
    .neq("status", "pending")
    .order("reviewed_at", { ascending: false })
    .limit(20);

  const queue = (pending ?? []) as PendingRequest[];

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
          New Student Accounts
        </h1>
        <p className="mt-2 max-w-prose text-ink-body">
          Registrations awaiting review. Approving a student creates their
          account and their public profile record, and sends them a link to
          choose a password.
        </p>
      </header>

      <section className="rule-notebook mt-10 pt-8">
        <h2 className="font-heading text-xl font-bold text-ink-strong">
          Awaiting review{" "}
          <span className="font-ui text-base font-normal text-ink-muted">
            ({queue.length})
          </span>
        </h2>

        {queue.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-border-subtle bg-surface p-8 text-center text-sm text-ink-muted">
            No registrations are waiting for review.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {queue.map((r) => (
              <AccountRequestCard key={r.id} request={r} />
            ))}
          </ul>
        )}
      </section>

      {(reviewed ?? []).length > 0 && (
        <section className="mt-12">
          <h2 className="font-heading text-xl font-bold text-ink-strong">
            Recently reviewed
          </h2>
          <ul className="mt-5 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
            {(reviewed ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-ui text-sm font-semibold text-ink-strong">
                    {r.full_name}
                  </p>
                  <p className="font-ui text-xs break-all text-ink-muted">{r.email}</p>
                  {r.review_note && (
                    <p className="mt-1 text-sm text-ink-body italic">{r.review_note}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 font-ui text-xs font-medium ${
                    r.status === "approved"
                      ? "bg-lgs-100 text-lgs-700"
                      : "bg-cell-coral/10 text-cell-coral-text"
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
