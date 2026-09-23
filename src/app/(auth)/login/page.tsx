import { PasswordForm } from "@/components/cms/PasswordForm";

export const metadata = { title: "Management area" };

/**
 * The only way in to the private CMS.
 *
 * One shared password, held by Research Cell leadership and School
 * Administration. There are no individual accounts, no registration and no
 * password reset — if the password needs changing, whoever maintains the site
 * changes it, and it changes for everyone at once.
 *
 * The page says nothing about who holds the password or what is behind it. It
 * is reachable by anyone who finds the URL, so it should give away nothing to
 * someone who has no business here.
 */
export default function CmsLoginPage() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-7">
      <p className="font-ui text-xs font-medium tracking-[0.2em] text-lgs-600 uppercase">
        1A1 Research Cell
      </p>
      <h1 className="mt-2 font-heading text-2xl font-extrabold text-ink-strong">
        Management area
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-body">
        For Research Cell leadership and school administration. Everything here
        edits the public site.
      </p>

      <div className="mt-6">
        <PasswordForm />
      </div>
    </div>
  );
}
