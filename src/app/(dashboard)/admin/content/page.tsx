import { SiteContentEditor, type ContentRow } from "@/components/content/ContentForms";
import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Site content" };

export default async function AdminContentPage() {
  await requireSchoolAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("site_content")
    .select("key, label, value, format, description")
    .order("key");

  const rows = (data ?? []) as ContentRow[];
  const pending = rows.filter((r) => !r.value || /^\s*\[PLACEHOLDER/i.test(r.value)).length;

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
          Site content
        </h1>
        <p className="mt-2 max-w-prose text-ink-body">
          Wording that appears on the public site. Changing it here takes effect
          immediately, with no redeployment. Only copy is editable &mdash; the
          structure of the site is not.
        </p>
      </header>

      {pending > 0 && (
        <p className="mt-6 rounded border border-cell-coral/30 bg-cell-coral/5 px-4 py-3 font-ui text-sm text-ink-body">
          <span className="font-semibold text-ink-strong">
            {pending} {pending === 1 ? "entry is" : "entries are"} still a placeholder.
          </span>{" "}
          Public pages omit these rather than showing placeholder text to
          visitors.
        </p>
      )}

      <section className="rule-notebook mt-10 space-y-5 pt-8">
        {rows.map((r) => (
          <SiteContentEditor key={r.key} row={r} />
        ))}
      </section>
    </>
  );
}
