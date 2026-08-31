import { ResourceEditor, type ResourceRow } from "@/components/content/ContentForms";
import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Resources" };

export default async function AdminResourcesPage() {
  await requireSchoolAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("resources")
    .select("id, category, title, description, body, external_url, is_published, display_order")
    .order("display_order");

  const rows = (data ?? []) as ResourceRow[];
  const published = rows.filter((r) => r.is_published).length;

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">Resources</h1>
        <p className="mt-2 max-w-prose text-ink-body">
          Guidance, templates and referencing help for Research Cell members.
          Each entry stays a draft until you publish it, so nothing reaches the
          public page before the school has agreed the wording.
        </p>
        <p className="mt-3 font-ui text-sm text-ink-muted">
          {published} of {rows.length} published.
        </p>
      </header>

      <section className="rule-notebook mt-10 pt-8">
        <ul className="space-y-4">
          {rows.map((r) => (
            <ResourceEditor key={r.id} row={r} />
          ))}
        </ul>
      </section>
    </>
  );
}
