"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth/session";
import { env } from "@/lib/env";

/**
 * Account administration.
 *
 * This is the only place in the application that uses the service-role client,
 * and every entry point below follows the same shape:
 *
 *   1. Establish who is calling, from their own session, through the ordinary
 *      RLS-backed client. Never from anything the browser sent.
 *   2. Refuse unless they are School Administration.
 *   3. Only then reach for elevated rights.
 *
 * Step 2 is not the security boundary either — the database would refuse a
 * student regardless. It is here so that a mistake in this file fails closed
 * rather than relying on the last line of defence.
 */

export type AdminActionState = {
  ok: boolean;
  message?: string;
  /**
   * Set after a successful approval when no mail provider is configured: the
   * invite link the student needs in order to set their password. Shown in the
   * admin interface so approval works with no email infrastructure at all.
   */
  inviteLink?: string;
};

/** Throws unless the caller is an active School Administrator. */
async function requireSchoolAdminActor() {
  const ctx = await getSessionContext();
  if (!ctx?.isSchoolAdmin) {
    throw new Error("Only School Administration may manage accounts.");
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// Approve
// -----------------------------------------------------------------------------

export async function approveAccountRequest(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return { ok: false, message: "Missing request." };

  let actor;
  try {
    actor = await requireSchoolAdminActor();
  } catch {
    return { ok: false, message: "You are not permitted to approve accounts." };
  }

  const admin = createAdminClient();

  // Read the request with elevated rights so the email is available for the
  // invite. The status is re-checked inside complete_account_approval under a
  // row lock, so two administrators clicking at once cannot both succeed.
  const { data: request, error: readError } = await admin
    .from("account_requests")
    .select("id, email, full_name, status")
    .eq("id", requestId)
    .maybeSingle();

  if (readError || !request) {
    return { ok: false, message: "That registration could not be found." };
  }
  if (request.status !== "pending") {
    return { ok: false, message: "That registration has already been reviewed." };
  }

  // ---------------------------------------------------------------------------
  // 1. Create the auth user.
  //
  // An invite is generated rather than a password being set here: the student
  // chooses their own, and no temporary secret ever exists to be intercepted.
  // generateLink creates the user and returns the link WITHOUT sending mail, so
  // approval does not depend on any mail provider being configured — which the
  // specification requires, since the school's email arrangements are undecided.
  // ---------------------------------------------------------------------------
  const redirectTo = `${env.siteUrl}/account/set-password`;

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: request.email,
    options: { redirectTo },
  });

  if (linkError || !linkData?.user) {
    // The most likely cause is an address that already has an auth user.
    return {
      ok: false,
      message:
        linkError?.message ??
        "Could not create the account for that email address.",
    };
  }

  const authUserId = linkData.user.id;

  // ---------------------------------------------------------------------------
  // 2. Create person, profile and role, and close the request — atomically.
  // ---------------------------------------------------------------------------
  const { error: rpcError } = await admin.rpc("complete_account_approval", {
    p_request_id: requestId,
    p_auth_user_id: authUserId,
    p_actor_id: actor.userId,
  });

  if (rpcError) {
    // The auth user exists but has no identity records, which would leave an
    // account that can sign in and do nothing. Remove it so the request can be
    // approved again cleanly.
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    console.error("complete_account_approval failed:", rpcError.code, rpcError.message);
    return {
      ok: false,
      message:
        rpcError.code === "P0001"
          ? "That registration has already been reviewed."
          : "Could not complete the approval. Nothing was changed.",
    };
  }

  revalidatePath("/admin/accounts");

  return {
    ok: true,
    message: `${request.full_name} has been approved.`,
    // Surfaced because no mail provider is configured yet. Once one is, this
    // link is emailed instead and stops being returned here.
    inviteLink: linkData.properties?.action_link,
  };
}

// -----------------------------------------------------------------------------
// Decline
// -----------------------------------------------------------------------------

export async function declineAccountRequest(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const requestId = String(formData.get("request_id") ?? "");
  const note = String(formData.get("review_note") ?? "").trim();
  if (!requestId) return { ok: false, message: "Missing request." };

  let actor;
  try {
    actor = await requireSchoolAdminActor();
  } catch {
    return { ok: false, message: "You are not permitted to review registrations." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("decline_account_request", {
    p_request_id: requestId,
    p_actor_id: actor.userId,
    p_note: note || null,
  });

  if (error) {
    return {
      ok: false,
      message:
        error.code === "P0001"
          ? "That registration has already been reviewed."
          : "Could not record that decision.",
    };
  }

  revalidatePath("/admin/accounts");
  return { ok: true, message: "Registration declined." };
}

// -----------------------------------------------------------------------------
// Suspend / reactivate / alumni
// -----------------------------------------------------------------------------

export async function setAccountStatus(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const profileId = String(formData.get("profile_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!["active", "suspended", "alumni"].includes(status)) {
    return { ok: false, message: "Unrecognised account status." };
  }

  let actor;
  try {
    actor = await requireSchoolAdminActor();
  } catch {
    return { ok: false, message: "You are not permitted to change account status." };
  }

  if (profileId === actor.userId) {
    // Removing your own administrative access is almost never intended and can
    // leave the school with no usable administrator.
    return { ok: false, message: "You cannot change the status of your own account." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("set_account_status", {
    p_profile_id: profileId,
    p_status: status,
    p_actor_id: actor.userId,
  });

  if (error) {
    return { ok: false, message: "Could not change that account's status." };
  }

  revalidatePath("/admin/accounts");
  return { ok: true, message: `Account set to ${status}.` };
}
