"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth/session";

/**
 * Profile visibility and leadership assignment.
 *
 * Same shape as account administration: establish who is calling from their own
 * RLS-backed session, refuse anyone who is not School Administration, and only
 * then use elevated rights. The database refuses these operations to everyone
 * else regardless — these checks make this file fail closed rather than lean on
 * that.
 */

export type PeopleActionState = { ok: boolean; message?: string };

async function requireSchoolAdminActor() {
  const ctx = await getSessionContext();
  if (!ctx?.isSchoolAdmin) {
    throw new Error("Only School Administration may manage profiles.");
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// Publish / unpublish a profile
// -----------------------------------------------------------------------------

export async function setProfileVisibility(
  _prev: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  const personId = String(formData.get("person_id") ?? "");
  const makePublic = String(formData.get("is_public") ?? "") === "true";
  if (!personId) return { ok: false, message: "Missing person." };

  let actor;
  try {
    actor = await requireSchoolAdminActor();
  } catch {
    return {
      ok: false,
      message: "Only School Administration may change profile visibility.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("set_profile_visibility", {
    p_person_id: personId,
    p_is_public: makePublic,
    p_actor_id: actor.userId,
  });

  if (error) {
    console.error("set_profile_visibility failed:", error.code, error.message);
    return { ok: false, message: "Could not change that profile's visibility." };
  }

  revalidatePath("/admin/people");
  revalidatePath("/people");
  return {
    ok: true,
    message: makePublic
      ? "Profile is now visible on the public People page."
      : "Profile is no longer shown publicly.",
  };
}

// -----------------------------------------------------------------------------
// Leadership
// -----------------------------------------------------------------------------

export async function assignLeadership(
  _prev: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  const personId = String(formData.get("person_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const yearId = String(formData.get("academic_year_id") ?? "");

  if (!["head_of_research", "deputy_head_of_research"].includes(role)) {
    return { ok: false, message: "Unrecognised leadership role." };
  }
  if (!personId || !yearId) {
    return { ok: false, message: "Choose a person and an academic year." };
  }

  let actor;
  try {
    actor = await requireSchoolAdminActor();
  } catch {
    return {
      ok: false,
      message: "Only School Administration may manage leadership.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("assign_leadership", {
    p_person_id: personId,
    p_role: role,
    p_academic_year_id: yearId,
    p_actor_id: actor.userId,
  });

  if (error) {
    console.error("assign_leadership failed:", error.code, error.message);
    return { ok: false, message: "Could not record that appointment." };
  }

  revalidatePath("/admin/people");
  revalidatePath("/people");
  return { ok: true, message: "Leadership appointment recorded." };
}
