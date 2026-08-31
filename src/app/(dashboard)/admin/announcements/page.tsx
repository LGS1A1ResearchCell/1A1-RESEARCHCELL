import { AnnouncementForm, type AnnouncementRow } from "@/components/content/ContentForms";
import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Announcements" };

export default async function AdminAnnouncementsPage() {
  await requireSchoolAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, starts_on, ends_on, is_visible")
    .order("starts_on", { ascending: false });

  const rows = (data ?? []) as AnnouncementRow[];
  const today = new Date().toISOString().slice(0, 10);
  const live = rows.filter(
    (a) => a.is_visible && a.starts_on <= today && (!a.ends_on || a.ends_on >= today),
  );

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
          Announcements
        </h1>
        <p className="mt-2 max-w-prose text-ink-body">
          Temporary notices shown on the homepage. An announcement stops
          appearing on its end date on its own &mdash; nothing needs to be
          switched off afterwards.
        </p>
        <p className="mt-3 font-ui text-sm text-ink-muted">
          {live.length} currently showing on the homepage.
        </p>
      </header>

      <section className="rule-notebook mt-10 pt-8">
        <h2 className="font-heading text-xl font-bold text-ink-strong">New announcement</h2>
        <div className="mt-4">
          <AnnouncementForm />
        </div>
      </section>

      {rows.length > 0 && (
        <section className="mt-12">
          <h2 className="font-heading text-xl font-bold text-ink-strong">
            All announcements{" "}
            <span className="font-ui text-base font-normal text-ink-muted">({rows.length})</span>
          </h2>
          <div className="mt-4 space-y-5">
            {rows.map((a) => (
              <AnnouncementForm key={a.id} row={a} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
