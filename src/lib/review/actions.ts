"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireLeadership } from "@/lib/auth/session";

/**
 * Reviewing research.
 *
 * No service-role client. Recording a review is something Research Cell
 * leadership is genuinely entitled to do, so it goes through their own session
 * and the database decides whether it stands:
 *
 *   - only leadership may insert into `reviews`
 *   - the reviewer must be the caller
 *   - nobody may review research they are an author of
 *   - a version carries one decision, enforced by a unique constraint
 *   - feedback is mandatory on a revision, enforced by a CHECK
 *
 * The paper's new status, the notifications to its authors and the audit entry
 * are all raised by triggers on the insert, so a decision and its consequences
 * cannot come apart.
 */

export type ReviewFormState = { ok: boolean; message?: string };

export async function recordReview(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const ctx = await requireLeadership();

  const versionId = String(formData.get("version_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const feedback = String(formData.get("feedback") ?? "").trim();

  if (!versionId) return { ok: false, message: "Missing version." };
  if (!["revision_required", "approved"].includes(decision)) {
    return { ok: false, message: "A review is either a revision request or an approval." };
  }
  if (decision === "revision_required" && feedback.length === 0) {
    return {
      ok: false,
      message: "Explain what needs changing — feedback is required when requesting a revision.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("reviews").insert({
    version_id: versionId,
    reviewer_id: ctx.userId,
    decision,
    feedback: feedback || null,
  });

  if (error) {
    // The guards explain themselves — reviewing your own work, a version that
    // already carries a decision, a paper not open for review. Those messages
    // are more useful to a reviewer than anything this file could invent.
    if (error.code === "42501") return { ok: false, message: error.message };
    if (error.code === "23505") {
      return {
        ok: false,
        message: "This version has already been reviewed. A further review needs a new version.",
      };
    }
    if (error.code === "23514") {
      return { ok: false, message: "Feedback is required when requesting a revision." };
    }
    console.error("recordReview failed:", error.code, error.message);
    return { ok: false, message: "That review could not be recorded." };
  }

  revalidatePath("/admin/review");
  revalidatePath("/my-research");
  return {
    ok: true,
    message:
      decision === "approved"
        ? "Approved. The authors have been notified."
        : "Revision requested. The authors have been notified.",
  };
}

/**
 * Reopen an approved paper so a correction can be made before publication.
 *
 * The status machine allows this transition to leadership only, and clears the
 * approval timestamp with it: the earlier approval no longer stands and a fresh
 * review is required. The review that granted it remains in the history against
 * the version it judged.
 */
export async function reopenForRevision(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  await requireLeadership();

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return { ok: false, message: "Missing submission." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("research_projects")
    .update({ status: "revision_required" })
    .eq("id", projectId);

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    console.error("reopenForRevision failed:", error.code, error.message);
    return { ok: false, message: "That submission could not be reopened." };
  }

  revalidatePath("/admin/review");
  revalidatePath(`/admin/review/${projectId}`);
  return { ok: true, message: "Reopened for revision. The authors can upload again." };
}

/** Short-lived link so a reviewer can read the submitted document. */
export async function signedReviewDocumentUrl(path: string): Promise<string | null> {
  await requireLeadership();
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("research-submissions")
    .createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}
