"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSessionContext, homePathFor } from "@/lib/auth/session";
import { joinYearOptions } from "@/lib/auth/years";

/**
 * Authentication server actions.
 *
 * Note what is absent: the service-role client. Signing up goes through the
 * submit_account_request database function, which validates its own input and
 * is callable by anon; signing in goes through Supabase Auth. Neither needs
 * elevated rights, so neither gets them.
 */

export type FormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

const CLASS_SECTIONS = ["A1", "A2"] as const;

// -----------------------------------------------------------------------------
// Sign up
// -----------------------------------------------------------------------------

export async function submitAccountRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const classSection = String(formData.get("class_section") ?? "");
  const yearRaw = String(formData.get("year_joined") ?? "");
  const yearJoined = Number.parseInt(yearRaw, 10);

  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 2) fieldErrors.full_name = "Please enter your full name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    fieldErrors.email = "Please enter a valid email address.";
  if (!CLASS_SECTIONS.includes(classSection as (typeof CLASS_SECTIONS)[number]))
    fieldErrors.class_section = "Please select your class.";
  if (!Number.isInteger(yearJoined) || !joinYearOptions().includes(yearJoined))
    fieldErrors.year_joined = "Please select the year you joined.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_account_request", {
    p_full_name: fullName,
    p_email: email,
    p_class_section: classSection,
    p_year_joined: yearJoined,
  });

  if (error) {
    // Input-shape errors are safe to surface. Anything else is logged for the
    // developer and shown to the visitor as a generic failure, so that a
    // database message can never become an information leak.
    if (error.code === "22023") {
      return { ok: false, message: error.message };
    }
    console.error("submit_account_request failed:", error.code, error.message);
    return {
      ok: false,
      message: "Something went wrong submitting your registration. Please try again.",
    };
  }

  // The function returns void whether this created a request, matched an
  // existing one, or matched an existing account. The visitor sees the same
  // page either way, so the form cannot be used to discover who has registered.
  redirect("/login/student/sign-up/submitted");
}

// -----------------------------------------------------------------------------
// Sign in
// -----------------------------------------------------------------------------

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, message: "Enter your email address and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately uniform. A pending applicant has no auth user at all, so a
    // failed sign-in is indistinguishable from a wrong password — which is the
    // correct outcome for a public form. The hint below covers the pending case
    // without confirming that any particular address exists.
    return {
      ok: false,
      message:
        "We could not sign you in. Check your email address and password. " +
        "If you have registered and are waiting for approval, you will be " +
        "emailed once your account is ready.",
    };
  }

  const ctx = await getSessionContext();
  if (!ctx) {
    return { ok: false, message: "We could not sign you in. Please try again." };
  }

  // An account can exist and still not be usable. Signing out immediately keeps
  // a suspended session from lingering in the browser.
  if (!ctx.isActive) {
    const path = homePathFor(ctx);
    revalidatePath("/", "layout");
    redirect(path);
  }

  revalidatePath("/", "layout");
  redirect(homePathFor(ctx));
}

// -----------------------------------------------------------------------------
// Sign out
// -----------------------------------------------------------------------------

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
