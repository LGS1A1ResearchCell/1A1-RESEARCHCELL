import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Activity log" };

/**
 * The administrative audit log.
 *
 * School Administration only. That is enforced by activity_log_admin_read —
 * students and Research Cell leadership read nothing from this table at all,
 * and the view inherits that because it carries security_invoker.
 *
 * Nothing here can be forged: client roles have INSERT on activity_log revoked
 * outright, so every entry was written by a trigger as the action happened.
 */

const LABEL: Record<string, { text: string; tone: string }> = {
  "account.approved": { text: "Account approved", tone: "bg-lgs-100 text-lgs-700" },
  "account.declined": { text: "Registration declined", tone: "bg-cell-coral/10 text-cell-coral-text" },
  "account.status_changed": { text: "Account status changed", tone: "bg-cell-coral/10 text-cell-coral-text" },
  "permission.granted": { text: "Permission granted", tone: "bg-cell-coral/10 text-cell-coral-text" },
  "permission.revoked": { text: "Permission revoked", tone: "bg-cell-coral/10 text-cell-coral-text" },
  "profile.visibility_changed": { text: "Profile visibility changed", tone: "bg-surface-sunken text-ink-muted" },
  "leadership.assigned": { text: "Leadership assigned", tone: "bg-lgs-100 text-lgs-700" },
  "research.submitted": { text: "Paper submitted", tone: "bg-surface-sunken text-ink-muted" },
  "research.revision_requested": { text: "Revision requested", tone: "bg-cell-coral/10 text-cell-coral-text" },
  "research.approved": { text: "Paper approved", tone: "bg-lgs-100 text-lgs-700" },
  "journal.created": { text: "Journal created", tone: "bg-surface-sunken text-ink-muted" },
  "journal.submitted_for_approval": { text: "Journal submitted", tone: "bg-surface-sunken text-ink-muted" },
  "journal.approved": { text: "Journal approved", tone: "bg-lgs-100 text-lgs-700" },
  "journal.published": { text: "Journal published", tone: "bg-lgs-200 text-lgs-800" },
  "journal.correction_recorded": { text: "Correction recorded", tone: "bg-surface-sunken text-ink-muted" },
  "journal.correction_approved": { text: "Correction approved", tone: "bg-lgs-100 text-lgs-700" },
};

/** A short, readable line from whatever metadata the trigger recorded. */
function describe(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const bits: string[] = [];
  const push = (k: string, prefix = "") => {
    const v = metadata[k];
    if (v !== undefined && v !== null && v !== "") bits.push(`${prefix}${String(v)}`);
  };
  push("title");
  push("name");
  push("role", "role: ");
  push("to", "→ ");
  push("papers", "papers: ");
  push("version", "version ");
  return bits.length ? bits.join(" · ") : null;
}

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSchoolAdmin();
  const params = await searchParams;
  const raw = params.action;
  const filter = Array.isArray(raw) ? raw[0] : raw;

  const supabase = await createClient();
  let query = supabase
    .from("activity_log_readable")
    .select("id, action, entity_type, entity_id, metadata, created_at, actor_name")
    .order("created_at", { ascending: false })
    .limit(250);

  if (filter) query = query.eq("action", filter);
  const { data } = await query;
  const rows = data ?? [];

  const { data: all } = await supabase.from("activity_log_readable").select("action");
  const counts = new Map<string, number>();
  for (const r of all ?? []) counts.set(r.action, (counts.get(r.action) ?? 0) + 1);
  const actions = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
          Activity log
        </h1>
        <p className="mt-2 max-w-prose text-ink-body">
          A permanent record of administrative and editorial actions. Entries are
          written as each action happens and cannot be edited or removed by
          anyone, including school administration.
        </p>
      </header>

      {actions.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <a
            href="/admin/activity"
            className={`rounded-full border px-3 py-1 font-ui text-xs transition-colors ${
              !filter
                ? "border-lgs-600 bg-lgs-50 font-semibold text-lgs-700"
                : "border-border-subtle text-ink-body hover:border-lgs-500"
            }`}
          >
            All ({all?.length ?? 0})
          </a>
          {actions.map(([a, n]) => (
            <a
              key={a}
              href={`/admin/activity?action=${encodeURIComponent(a)}`}
              className={`rounded-full border px-3 py-1 font-ui text-xs transition-colors ${
                filter === a
                  ? "border-lgs-600 bg-lgs-50 font-semibold text-lgs-700"
                  : "border-border-subtle text-ink-body hover:border-lgs-500"
              }`}
            >
              {LABEL[a]?.text ?? a} ({n})
            </a>
          ))}
        </div>
      )}

      <section className="rule-notebook mt-8 pt-8">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-subtle bg-surface p-10 text-center text-sm text-ink-muted">
            {filter ? "No entries of that kind." : "No activity recorded yet."}
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
            {rows.map((r) => {
              const l = LABEL[r.action] ?? {
                text: r.action,
                tone: "bg-surface-sunken text-ink-muted",
              };
              const detail = describe(r.metadata as Record<string, unknown> | null);
              return (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 font-ui text-xs font-medium ${l.tone}`}
                    >
                      {l.text}
                    </span>
                    {detail && (
                      <p className="mt-1.5 font-ui text-sm text-ink-strong">{detail}</p>
                    )}
                    <p className="mt-1 font-ui text-xs text-ink-muted">
                      {r.actor_name ?? "System"}
                      {r.entity_type ? ` · ${r.entity_type}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-ui text-xs text-ink-muted">
                    {new Date(r.created_at).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
