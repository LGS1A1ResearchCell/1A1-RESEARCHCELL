"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireActiveAccount } from "@/lib/auth/session";

/**
 * Research submission.
 *
 * No service-role client anywhere in this file. Every operation here is one a
 * student is genuinely entitled to perform, so it runs through their own
 * session and is checked by the database:
 *
 *   create_research_project    — creates the project and its Team Leader row
 *                                together, so a project never exists without
 *                                exactly one leader
 *   add_research_version       — assigns the version number under a row lock
 *   research_authors           — ordinary RLS insert, then guarded by triggers
 *   research_projects.status   — ordinary RLS update, then guarded by the
 *                                status machine
 *
 * If any of this tried to exceed what a student may do, the database would
 * refuse it rather than this code being the only thing standing in the way.
 */

export type ResearchFormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPTED_DOC = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// -----------------------------------------------------------------------------
// Create a draft
// -----------------------------------------------------------------------------

export async function createResearchProject(
  _prev: ResearchFormState,
  formData: FormData,
): Promise<ResearchFormState> {
  await requireActiveAccount();

  const title = String(formData.get("title") ?? "").trim();
  const researchType = String(formData.get("research_type") ?? "");
  const authorshipMode = String(formData.get("authorship_mode") ?? "");
  const subjectId = String(formData.get("subject_id") ?? "");
  const researchArea = String(formData.get("research_area") ?? "").trim();
  const abstract = String(formData.get("abstract") ?? "").trim();
  const teamName = String(formData.get("team_name") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (title.length < 5) fieldErrors.title = "Please give your research a title.";
  if (!["primary", "secondary", "independent"].includes(researchType))
    fieldErrors.research_type = "Choose the type of research.";
  if (!["individual", "team"].includes(authorshipMode))
    fieldErrors.authorship_mode = "Choose individual or team research.";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const supabase = await createClient();
  const { data: projectId, error } = await supabase.rpc("create_research_project", {
    p_title: title,
    p_research_type: researchType,
    p_authorship_mode: authorshipMode,
    p_subject_id: subjectId || null,
    p_research_area: researchArea || null,
    p_abstract: abstract || null,
    p_team_name: authorshipMode === "team" && teamName ? teamName : null,
  });

  if (error) {
    if (error.code === "22023") return { ok: false, message: error.message };
    console.error("create_research_project failed:", error.code, error.message);
    return { ok: false, message: "Your submission could not be created." };
  }

  revalidatePath("/my-research");
  redirect(`/my-research/${projectId}`);
}

// -----------------------------------------------------------------------------
// Upload a document (a new version, never a replacement)
// -----------------------------------------------------------------------------

export async function uploadResearchDocument(
  _prev: ResearchFormState,
  formData: FormData,
): Promise<ResearchFormState> {
  await requireActiveAccount();

  const projectId = String(formData.get("project_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const file = formData.get("document");

  if (!projectId) return { ok: false, message: "Missing submission." };
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, message: "Choose a document to upload." };
  if (!ACCEPTED_DOC.includes(file.type))
    return { ok: false, message: "Upload a PDF or Word document." };
  if (file.size > MAX_BYTES)
    return { ok: false, message: "Documents must be under 50 MB." };

  const supabase = await createClient();

  // The storage policy requires the first path segment to be the project id and
  // the caller to be that project's Team Leader. The timestamp keeps every
  // version at its own path, which is what makes revisions additive rather than
  // overwriting: the earlier document stays exactly where it was.
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
  const path = `${projectId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("research-submissions")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("document upload failed:", uploadError.message);
    return { ok: false, message: "Your document could not be uploaded." };
  }

  const { error } = await supabase.rpc("add_research_version", {
    p_project_id: projectId,
    p_path: path,
    p_filename: file.name,
    p_mime: file.type,
    p_size_bytes: file.size,
    p_notes: notes || null,
  });

  if (error) {
    // Leave no orphan object behind if the version could not be recorded.
    await supabase.storage.from("research-submissions").remove([path]);
    console.error("add_research_version failed:", error.code, error.message);
    return { ok: false, message: "Your document could not be recorded." };
  }

  revalidatePath(`/my-research/${projectId}`);
  return { ok: true, message: "Document uploaded." };
}

// -----------------------------------------------------------------------------
// Team members
// -----------------------------------------------------------------------------

export async function searchMembers(query: string) {
  await requireActiveAccount();
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_research_cell_members", {
    p_query: query || null,
  });
  return (data ?? []) as { id: string; full_name: string; class_section: string | null }[];
}

export async function addCoAuthor(
  _prev: ResearchFormState,
  formData: FormData,
): Promise<ResearchFormState> {
  await requireActiveAccount();

  const projectId = String(formData.get("project_id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  if (!projectId || !personId)
    return { ok: false, message: "Choose someone to add." };

  const supabase = await createClient();

  const { count } = await supabase
    .from("research_authors")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { error } = await supabase.from("research_authors").insert({
    project_id: projectId,
    person_id: personId,
    author_role: "co_author",
    author_order: (count ?? 1) + 1,
  });

  if (error) {
    // 42501 carries the guard's own explanation — no active account, or the
    // list already frozen by a confirmation. Those are worth showing verbatim.
    if (error.code === "42501") return { ok: false, message: error.message };
    if (error.code === "23505")
      return { ok: false, message: "That person is already an author." };
    console.error("addCoAuthor failed:", error.code, error.message);
    return { ok: false, message: "That author could not be added." };
  }

  revalidatePath(`/my-research/${projectId}`);
  return { ok: true, message: "Author added. They have been asked to confirm." };
}

export async function removeCoAuthor(
  _prev: ResearchFormState,
  formData: FormData,
): Promise<ResearchFormState> {
  await requireActiveAccount();

  const projectId = String(formData.get("project_id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  if (!projectId || !personId) return { ok: false, message: "Missing author." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("research_authors")
    .delete()
    .eq("project_id", projectId)
    .eq("person_id", personId);

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "That author could not be removed." };
  }

  revalidatePath(`/my-research/${projectId}`);
  return { ok: true, message: "Author removed. The change has been recorded." };
}

// -----------------------------------------------------------------------------
// Confirm your own authorship
// -----------------------------------------------------------------------------

export async function confirmAuthorship(
  _prev: ResearchFormState,
  formData: FormData,
): Promise<ResearchFormState> {
  const ctx = await requireActiveAccount();

  const projectId = String(formData.get("project_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!projectId) return { ok: false, message: "Missing submission." };
  if (!["confirmed", "declined"].includes(decision))
    return { ok: false, message: "Unrecognised response." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("research_authors")
    .update({
      confirmation_status: decision,
      confirmed_at: decision === "confirmed" ? new Date().toISOString() : null,
    })
    // Scoped to the caller's own row. The guard trigger enforces this too, but
    // the query should not even attempt anyone else's.
    .eq("project_id", projectId)
    .eq("person_id", ctx.personId!);

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    console.error("confirmAuthorship failed:", error.code, error.message);
    return { ok: false, message: "Your response could not be recorded." };
  }

  revalidatePath(`/my-research/${projectId}`);
  revalidatePath("/my-research");
  return {
    ok: true,
    message:
      decision === "confirmed"
        ? "You have confirmed your authorship."
        : "You have declined authorship on this submission.",
  };
}

// -----------------------------------------------------------------------------
// Move the submission along
// -----------------------------------------------------------------------------

export async function advanceSubmission(
  _prev: ResearchFormState,
  formData: FormData,
): Promise<ResearchFormState> {
  await requireActiveAccount();

  const projectId = String(formData.get("project_id") ?? "");
  const target = String(formData.get("status") ?? "");
  if (!["awaiting_author_confirmation", "submitted", "draft"].includes(target))
    return { ok: false, message: "Unrecognised status." };

  const supabase = await createClient();
  const patch: Record<string, unknown> = { status: target };
  if (target === "submitted") patch.submitted_at = new Date().toISOString();

  const { error } = await supabase
    .from("research_projects")
    .update(patch)
    .eq("id", projectId);

  if (error) {
    // The status machine explains itself — missing document, unconfirmed
    // authors, wrong transition. Show that rather than a generic failure.
    if (error.code === "42501") return { ok: false, message: error.message };
    console.error("advanceSubmission failed:", error.code, error.message);
    return { ok: false, message: "That change could not be made." };
  }

  revalidatePath(`/my-research/${projectId}`);
  revalidatePath("/my-research");
  revalidatePath("/dashboard");
  return { ok: true, message: "Submission updated." };
}

/** Short-lived link to a stored document; the bucket is private. */
export async function signedDocumentUrl(path: string): Promise<string | null> {
  await requireActiveAccount();
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("research-submissions")
    .createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}
