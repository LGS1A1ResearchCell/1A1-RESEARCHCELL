import { ProfileForm } from "@/components/people/ProfileForm";
import { photoUrl } from "@/components/people/Portrait";
import { requireActiveAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My profile" };

export default async function ProfilePage() {
  const ctx = await requireActiveAccount();
  const supabase = await createClient();

  const { data: person } = await supabase
    .from("people")
    .select("full_name, class_section, year_joined, quote, photo_path, photo_focal_x, photo_focal_y, is_public")
    .eq("id", ctx.personId!)
    .maybeSingle();

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
          My profile
        </h1>
        <p className="mt-2 text-ink-body">
          How you appear in the Research Cell record.
        </p>
      </header>

      <section className="rule-notebook mt-10 max-w-2xl pt-8">
        {/* Identity is set at approval and is administration's to correct.
            Shown read-only so it is clear why it cannot be edited here. */}
        <dl className="mb-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border border-border-subtle bg-surface p-5">
          <dt className="font-ui text-sm text-ink-muted">Name</dt>
          <dd className="font-ui text-sm font-semibold text-ink-strong">
            {person?.full_name}
          </dd>
          <dt className="font-ui text-sm text-ink-muted">Class</dt>
          <dd className="font-ui text-sm text-ink-strong">
            {person?.class_section ?? "—"}
          </dd>
          <dt className="font-ui text-sm text-ink-muted">Joined</dt>
          <dd className="font-ui text-sm text-ink-strong">
            {person?.year_joined ?? "—"}
          </dd>
          <dt className="font-ui text-sm text-ink-muted">Public profile</dt>
          <dd className="font-ui text-sm text-ink-strong">
            {person?.is_public ? "Visible on the People page" : "Not shown publicly"}
          </dd>
        </dl>

        <p className="mb-8 rounded border border-border-subtle bg-surface-muted px-4 py-3 font-ui text-xs leading-relaxed text-ink-muted">
          Your name, class and year joined are recorded by school administration
          when your account is approved. Whether your profile appears publicly is
          also decided by school administration. Speak to them if anything above
          needs correcting.
        </p>

        <ProfileForm
          initialUrl={photoUrl(person?.photo_path)}
          initialFocal={{
            focalX: Number(person?.photo_focal_x ?? 0.5),
            focalY: Number(person?.photo_focal_y ?? 0.4),
          }}
          initialQuote={person?.quote ?? ""}
        />
      </section>
    </>
  );
}
