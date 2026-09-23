"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { cmsSecrets } from "@/lib/cms/secrets";
import { verifyPassword } from "@/lib/cms/password";

/**
 * Authentication for the private CMS.
 *
 * There is one shared password and no individual accounts. Getting in is two
 * steps, and they are deliberately distinct:
 *
 *   1. The password typed into the form is checked against CMS_PASSWORD_HASH.
 *      That is the only secret anybody is told.
 *   2. On success the server signs in to Supabase as a real account holding the
 *      school_admin role, and the resulting session is stored in the existing
 *      httpOnly cookie.
 *
 * Step 2 is the important one. It would be simpler to accept the password and
 * then talk to the database with the service-role key, but that key ignores
 * every Row Level Security policy in the schema — the CMS would become trusted
 * code, and a mistake in any server action would become a whole-database
 * mistake. Signing in as an ordinary account instead means the database keeps
 * enforcing exactly what it enforced before, and the CMS is only a caller.
 *
 * The Supabase credentials are never shown to anyone and never leave the
 * server; rotating the shared password does not touch them.
 */

export type FormState = {
  ok: boolean;
  message?: string;
};

/**
 * A wrong password costs a fixed second before it answers.
 *
 * This is a speed bump, not rate limiting: it slows a naive script without
 * meaningfully stopping a determined one, and on serverless it cannot keep
 * state across instances. Real throttling belongs in front of the application —
 * recorded as an open item in docs/HANDOVER.md rather than pretended at here.
 */
const WRONG_PASSWORD_DELAY_MS = 1000;

export async function signInToCms(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const password = String(formData.get("password") ?? "");

  if (!password) {
    return { ok: false, message: "Enter the management password." };
  }

  let accepted = false;
  try {
    accepted = await verifyPassword(password, cmsSecrets.passwordHash());
  } catch (error) {
    // A missing or malformed CMS_PASSWORD_HASH is a deployment fault, not the
    // visitor's. Say so plainly rather than implying they got it wrong.
    console.error("CMS password check could not run:", error);
    return {
      ok: false,
      message:
        "The management area is not configured on this deployment. " +
        "Contact whoever maintains the site.",
    };
  }

  if (!accepted) {
    await new Promise((resolve) => setTimeout(resolve, WRONG_PASSWORD_DELAY_MS));
    return { ok: false, message: "That password was not recognised." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: cmsSecrets.supabaseEmail(),
    password: cmsSecrets.supabasePassword(),
  });

  if (error) {
    // The password was right but the account behind the CMS is wrong or
    // missing. Never surface which account, or why.
    console.error("CMS sign-in failed:", error.message);
    return {
      ok: false,
      message:
        "The password was accepted but the management account could not be " +
        "reached. Contact whoever maintains the site.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
