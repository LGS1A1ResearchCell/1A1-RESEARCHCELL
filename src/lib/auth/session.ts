import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Session and authorization helpers.
 *
 * Everything here reads through the ordinary server client, using the caller's
 * own session and subject to Row Level Security. A student reads their own
 * profile and their own role because policies allow exactly that — none of it
 * needs elevated rights, and none of it is trusted by the database.
 *
 * These helpers decide what a page renders. They are not the security boundary:
 * that remains RLS. A bug here shows someone the wrong page; it cannot show
 * them data the database would not have handed over anyway.
 */

export type AppRole = "student" | "leadership" | "school_admin";
export type AccountStatus = "pending" | "active" | "suspended" | "alumni";

export type SessionContext = {
  userId: string;
  email: string | null;
  personId: string | null;
  status: AccountStatus | null;
  role: AppRole | null;
  /** True only for an account that may act, not merely read. */
  isActive: boolean;
  isLeadership: boolean;
  isSchoolAdmin: boolean;
};

/** The signed-in user with their profile and role, or null if signed out. */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();

  // getUser() revalidates against Supabase. getSession() only decodes a cookie
  // and can be forged, so it must not be used here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("person_id, status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  // Highest privilege held wins, so a school_admin who also carries the student
  // role is treated as an administrator.
  const held = new Set((roles ?? []).map((r: { role: string }) => r.role));
  const role: AppRole | null = held.has("school_admin")
    ? "school_admin"
    : held.has("leadership")
      ? "leadership"
      : held.has("student")
        ? "student"
        : null;

  const status = (profile?.status ?? null) as AccountStatus | null;
  const isActive = status === "active";

  return {
    userId: user.id,
    email: user.email ?? null,
    personId: profile?.person_id ?? null,
    status,
    role,
    isActive,
    // Mirrors is_leadership() and is_school_admin() in the database, including
    // the requirement that the account be active.
    isLeadership: isActive && (role === "leadership" || role === "school_admin"),
    isSchoolAdmin: isActive && role === "school_admin",
  };
}

/**
 * Require a usable session, or send the visitor away.
 *
 * Anyone who is not signed in goes to the one login page. Anyone who is signed
 * in but whose account is not active goes to the public site rather than back
 * to the login form: the password would work, they would land here again, and
 * the loop would never end. The public site is the honest destination — it is
 * what they are entitled to see.
 */
export async function requireActiveAccount(
  loginPath = "/login",
): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect(loginPath);
  if (!ctx.isActive) redirect("/");
  return ctx;
}

export async function requireLeadership(): Promise<SessionContext> {
  const ctx = await requireActiveAccount();
  if (!ctx.isLeadership) redirect("/");
  return ctx;
}

export async function requireSchoolAdmin(): Promise<SessionContext> {
  const ctx = await requireActiveAccount();
  if (!ctx.isSchoolAdmin) redirect("/");
  return ctx;
}
