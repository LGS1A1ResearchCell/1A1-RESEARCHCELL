/**
 * Centralised environment access.
 *
 * No other module reads `process.env` directly. Resolving every value here means
 * a missing variable fails immediately with an actionable message, instead of
 * surfacing later as an opaque Supabase connection error.
 *
 * Public values are referenced by their full literal name so Next can inline
 * them into the client bundle at build time. Secrets are deliberately absent
 * from this module — see `lib/supabase/admin.ts`.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}.\n` +
        "Copy .env.example to .env.local and fill in the values from your " +
        "Supabase project (Project Settings -> API).",
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL",
  ),
  supabaseAnonKey: required(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
} as const;

/** True only in a real production deployment, used to gate dev-only affordances. */
export const isProduction = env.appEnv === "production";
