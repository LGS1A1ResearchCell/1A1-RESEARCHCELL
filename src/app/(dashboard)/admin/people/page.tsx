import { LeadershipForm } from "@/components/admin/LeadershipForm";
import { VisibilityToggle } from "@/components/admin/VisibilityToggle";
import { Portrait } from "@/components/people/Portrait";
import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "People" };

const ROLE_TITLE: Record<string, string> = {
  head_of_research: "Head of Research",
  deputy_head_of_research: "Deputy Head of Research",
};

/**
 * People administration.
 *
 * Publishing a profile lives here and nowhere else. Research Cell leadership
 * cannot reach this page, and set_profile_visibility refuses them even if they
 * were to call it directly.
 */
export default async function AdminPeoplePage() {
  await requireSchoolAdmin();
  const supabase = await createClient();

  const [{ data: people }, { data: years }, { data: leadership }] = await Promise.all([
    supabase
      .from("people")
      .select("id, full_name, kind, class_section, year_joined, is_public, photo_path, photo_focal_x, photo_focal_y")
      .order("is_public", { ascending: false })
      .order("full_name"),
    supabase.from("academic_years").select("id, label, is_current").order("label", { ascending: false }),
    supabase
      .from("leadership")
      .select("id, role, academic_years(label, is_current), people(full_name)"),
  ]);

  const all = people ?? [];
  const publicCount = all.filter((p) => p.is_public).length;

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">People</h1>
        <p className="mt-2 max-w-prose text-ink-body">
          Who appears on the public People page, and who holds Research Cell
          leadership.
        </p>
      </header>

      {/* --------------------------------------------------------------- */}
      {/* Leadership                                                       */}
      {/* --------------------------------------------------------------- */}
      <section className="rule-notebook mt-10 pt-8" aria-labelledby="lead">
        <h2 id="lead" className="font-heading text-xl font-bold text-ink-strong">
          Leadership
        </h2>

        {(leadership ?? []).length > 0 && (
          <ul className="mt-5 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
            {(leadership ?? []).map((l) => {
              const yr = l.academic_years as unknown as { label: string; is_current: boolean } | null;
              const pe = l.people as unknown as { full_name: string } | null;
              return (
                <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3">
                  <span className="font-ui text-sm text-ink-strong">
                    <span className="font-semibold">{pe?.full_name}</span>
                    <span className="text-ink-muted"> — {ROLE_TITLE[l.role] ?? l.role}</span>
                  </span>
                  <span className="font-ui text-xs text-ink-muted">
                    {yr?.label}{yr?.is_current ? " (current)" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5">
          <LeadershipForm
            people={all.map((p) => ({ id: p.id, full_name: p.full_name }))}
            years={(years ?? []).map((y) => ({ id: y.id, label: y.label, is_current: y.is_current }))}
          />
        </div>
      </section>

      {/* --------------------------------------------------------------- */}
      {/* Visibility                                                       */}
      {/* --------------------------------------------------------------- */}
      <section className="mt-14" aria-labelledby="vis">
        <h2 id="vis" className="font-heading text-xl font-bold text-ink-strong">
          Public profiles{" "}
          <span className="font-ui text-base font-normal text-ink-muted">
            ({publicCount} of {all.length} shown publicly)
          </span>
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-body">
          A public profile shows the person&rsquo;s name, photograph, quote,
          class and year joined on the People page. New profiles are private
          until published here.
        </p>

        <ul className="mt-6 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
          {all.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-4 p-4">
              <Portrait
                name={p.full_name}
                photoPath={p.photo_path}
                focalX={Number(p.photo_focal_x ?? 0.5)}
                focalY={Number(p.photo_focal_y ?? 0.4)}
                size={44}
              />
              <div className="min-w-0 flex-1">
                <p className="font-ui text-sm font-semibold text-ink-strong">
                  {p.full_name}
                </p>
                <p className="font-ui text-xs text-ink-muted">
                  {[
                    p.kind === "faculty" ? "Faculty" : p.kind === "external" ? "External" : "Student",
                    p.class_section ? `Class ${p.class_section}` : null,
                    p.year_joined ? `Joined ${p.year_joined}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 font-ui text-xs font-medium ${
                  p.is_public ? "bg-lgs-100 text-lgs-700" : "bg-surface-sunken text-ink-muted"
                }`}
              >
                {p.is_public ? "Public" : "Private"}
              </span>
              <VisibilityToggle personId={p.id} isPublic={p.is_public} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
