import "server-only";

/**
 * Secrets for the private CMS.
 *
 * Separate from `lib/env.ts` on purpose: that module is read by client code, so
 * Next inlines its values into the browser bundle. Nothing here may ever reach a
 * browser, and the `server-only` import above makes an accidental client import
 * a build failure rather than a silent leak.
 *
 * Two different things live here, and the distinction matters:
 *
 *   CMS_PASSWORD_HASH   the shared password the school actually types. Stored
 *                       as a scrypt hash, never in clear text. Rotating it
 *                       means changing this one value.
 *
 *   CMS_SUPABASE_*      credentials for the Supabase account the CMS acts as
 *                       once the password has been accepted. Nobody types
 *                       these and nobody is told them; they exist so the CMS
 *                       still holds a real database identity, which is what
 *                       keeps Row Level Security doing the enforcing.
 *
 * Keeping them separate is the point. The school can change the shared password
 * without touching the database, and a leaked shared password does not hand
 * anyone direct API access.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}.\n` +
        "The private CMS cannot start without it. See docs/HANDOVER.md, " +
        "section 'Private CMS access'.",
    );
  }
  return value;
}

export const cmsSecrets = {
  /** scrypt hash of the shared password, as `scrypt$<salt>$<key>` (base64). */
  passwordHash: () => required(process.env.CMS_PASSWORD_HASH, "CMS_PASSWORD_HASH"),
  /** An existing Supabase account holding the school_admin role. */
  supabaseEmail: () => required(process.env.CMS_SUPABASE_EMAIL, "CMS_SUPABASE_EMAIL"),
  supabasePassword: () =>
    required(process.env.CMS_SUPABASE_PASSWORD, "CMS_SUPABASE_PASSWORD"),
} as const;
