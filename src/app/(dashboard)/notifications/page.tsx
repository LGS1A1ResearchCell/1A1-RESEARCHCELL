import Link from "next/link";

import { MarkAllRead, MarkRead } from "@/components/content/ContentForms";
import { requireActiveAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Notifications" };

/** Where each kind of notification should take the reader. */
function destinationFor(entityType: string | null, entityId: string | null): string | null {
  if (!entityId) return null;
  if (entityType === "research_project") return `/my-research/${entityId}`;
  if (entityType === "journal") return `/journals`;
  return null;
}

export default async function NotificationsPage() {
  await requireActiveAccount();
  const supabase = await createClient();

  // notifications_self_read scopes this to the caller; no filter here is doing
  // the security work.
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, entity_type, entity_id, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const list = data ?? [];
  const unread = list.filter((n) => !n.read_at);

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
            Notifications
          </h1>
          <p className="mt-2 text-ink-body">
            {unread.length > 0
              ? `${unread.length} unread`
              : "Everything here has been read."}
          </p>
        </div>
        {unread.length > 0 && <MarkAllRead />}
      </header>

      <section className="rule-notebook mt-10 pt-8">
        {list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-subtle bg-surface p-10 text-center text-sm text-ink-muted">
            You have no notifications.
          </p>
        ) : (
          <ul className="space-y-3">
            {list.map((n) => {
              const href = destinationFor(n.entity_type, n.entity_id);
              return (
                <li
                  key={n.id}
                  className={`rounded-lg border p-5 ${
                    n.read_at
                      ? "border-border-subtle bg-surface"
                      : "border-lgs-200 bg-lgs-50"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-heading text-base font-bold text-ink-strong">
                        {n.title}
                      </h2>
                      {n.body && (
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-body">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-2 font-ui text-xs text-ink-muted">
                        {new Date(n.created_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                      {href && (
                        <Link
                          href={href}
                          className="mt-2 inline-block font-ui text-sm font-semibold text-lgs-600 underline"
                        >
                          Open
                        </Link>
                      )}
                    </div>
                    {!n.read_at && <MarkRead id={n.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
