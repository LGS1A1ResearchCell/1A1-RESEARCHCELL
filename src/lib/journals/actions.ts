"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireLeadership, requireSchoolAdmin } from "@/lib/auth/session";

/**
 * The journal builder.
 *
 * No service-role client. Everything here is something leadership or School
 * Administration is genuinely entitled to do, so it runs through their own
 * session and the database decides whether it stands:
 *
 *   - only leadership may create or edit a journal
 *   - only approved research may be added to one
 *   - a paper appears in one journal only
 *   - submitting for approval requires at least one paper
 *   - only School Administration may approve or publish
 *   - a published journal is closed: contents, masthead and details all frozen
 *
 * Publishing cascades to the papers, notifies every author and writes the audit
 * entry by trigger, so those cannot come apart from the act itself.
 */

export type JournalFormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_COVER = 10 * 1024 * 1024;
const MAX_PDF = 100 * 1024 * 1024;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/, "") || "journal";
}

// -----------------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------------

export async function createJournal(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  const ctx = await requireLeadership();

  const title = String(formData.get("title") ?? "").trim();
  const volume = String(formData.get("volume_label") ?? "").trim();
  const yearId = String(formData.get("academic_year_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (title.length < 3) fieldErrors.title = "Give the journal a title.";
  if (!yearId) fieldErrors.academic_year_id = "Choose an academic year.";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journals")
    .insert({
      title,
      volume_label: volume || null,
      slug: slugify(title),
      academic_year_id: yearId,
      description: description || null,
      status: "draft",
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) {
    // One journal per academic year is a unique index; a clash means that year
    // already has an issue, which is worth saying plainly.
    if (error.code === "23505") {
      return {
        ok: false,
        message:
          "That academic year already has a journal, or the title produces a slug already in use.",
      };
    }
    if (error.code === "42501") return { ok: false, message: error.message };
    console.error("createJournal failed:", error.code, error.message);
    return { ok: false, message: "That journal could not be created." };
  }

  revalidatePath("/admin/journals");
  redirect(`/admin/journals/${data.id}`);
}

// -----------------------------------------------------------------------------
// Details
// -----------------------------------------------------------------------------

export async function updateJournalDetails(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  await requireLeadership();

  const id = String(formData.get("journal_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const volume = String(formData.get("volume_label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!id) return { ok: false, message: "Missing journal." };
  if (title.length < 3) return { ok: false, fieldErrors: { title: "Give the journal a title." } };

  const supabase = await createClient();
  const { error } = await supabase
    .from("journals")
    .update({ title, volume_label: volume || null, description: description || null })
    .eq("id", id);

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "Those details could not be saved." };
  }

  revalidatePath(`/admin/journals/${id}`);
  return { ok: true, message: "Details saved." };
}

// -----------------------------------------------------------------------------
// Contents
// -----------------------------------------------------------------------------

export async function addPaperToJournal(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  await requireLeadership();

  const journalId = String(formData.get("journal_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!journalId || !projectId) return { ok: false, message: "Choose a paper to add." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("journal_papers")
    .select("id", { count: "exact", head: true })
    .eq("journal_id", journalId);

  const { error } = await supabase.from("journal_papers").insert({
    journal_id: journalId,
    project_id: projectId,
    display_order: (count ?? 0) + 1,
  });

  if (error) {
    // The guard explains itself: unapproved research, or a closed journal.
    if (error.code === "42501") return { ok: false, message: error.message };
    if (error.code === "23505") {
      return {
        ok: false,
        message: "That paper is already in a journal. A paper appears in one issue only.",
      };
    }
    console.error("addPaperToJournal failed:", error.code, error.message);
    return { ok: false, message: "That paper could not be added." };
  }

  revalidatePath(`/admin/journals/${journalId}`);
  return { ok: true, message: "Paper added." };
}

export async function removePaperFromJournal(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  await requireLeadership();

  const journalId = String(formData.get("journal_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!journalId || !projectId) return { ok: false, message: "Missing paper." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("journal_papers")
    .delete()
    .eq("journal_id", journalId)
    .eq("project_id", projectId);

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "That paper could not be removed." };
  }

  revalidatePath(`/admin/journals/${journalId}`);
  return { ok: true, message: "Paper removed." };
}

/** Move a paper one place up or down in the running order. */
export async function reorderPaper(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  await requireLeadership();

  const journalId = String(formData.get("journal_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!journalId || !projectId || !["up", "down"].includes(direction)) {
    return { ok: false, message: "Missing move." };
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("journal_papers")
    .select("project_id, display_order")
    .eq("journal_id", journalId)
    .order("display_order");

  const list = rows ?? [];
  const i = list.findIndex((r) => r.project_id === projectId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };

  // Swap the two display_order values. Ordering is a small integer per row, so
  // a swap is enough and leaves every other paper untouched.
  const a = list[i];
  const b = list[j];
  const { error } = await supabase
    .from("journal_papers")
    .update({ display_order: b.display_order })
    .eq("journal_id", journalId)
    .eq("project_id", a.project_id);

  if (!error) {
    await supabase
      .from("journal_papers")
      .update({ display_order: a.display_order })
      .eq("journal_id", journalId)
      .eq("project_id", b.project_id);
  }

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "The order could not be changed." };
  }

  revalidatePath(`/admin/journals/${journalId}`);
  return { ok: true };
}

export async function setPaperPages(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  await requireLeadership();

  const journalId = String(formData.get("journal_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const startRaw = String(formData.get("start_page") ?? "").trim();
  const endRaw = String(formData.get("end_page") ?? "").trim();

  const start = startRaw === "" ? null : Number.parseInt(startRaw, 10);
  const end = endRaw === "" ? null : Number.parseInt(endRaw, 10);

  if ((start !== null && !Number.isFinite(start)) || (end !== null && !Number.isFinite(end))) {
    return { ok: false, message: "Page numbers must be whole numbers." };
  }
  if (start !== null && end !== null && end < start) {
    return { ok: false, message: "The last page cannot come before the first." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("journal_papers")
    .update({ start_page: start, end_page: end })
    .eq("journal_id", journalId)
    .eq("project_id", projectId);

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "Those page numbers could not be saved." };
  }

  revalidatePath(`/admin/journals/${journalId}`);
  return { ok: true, message: "Page numbers saved." };
}

// -----------------------------------------------------------------------------
// Masthead
// -----------------------------------------------------------------------------

export async function addJournalCredit(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  await requireLeadership();

  const journalId = String(formData.get("journal_id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  const creditTitle = String(formData.get("credit_title") ?? "").trim();

  if (!journalId || !personId || !creditTitle) {
    return { ok: false, message: "Choose a person and give the credit a title." };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("journal_credits")
    .select("id", { count: "exact", head: true })
    .eq("journal_id", journalId);

  const { error } = await supabase.from("journal_credits").insert({
    journal_id: journalId,
    person_id: personId,
    credit_title: creditTitle,
    display_order: (count ?? 0) + 1,
  });

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    if (error.code === "23505")
      return { ok: false, message: "That person already holds that credit on this journal." };
    return { ok: false, message: "That credit could not be added." };
  }

  revalidatePath(`/admin/journals/${journalId}`);
  return { ok: true, message: "Credit added." };
}

export async function removeJournalCredit(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  await requireLeadership();

  const journalId = String(formData.get("journal_id") ?? "");
  const creditId = String(formData.get("credit_id") ?? "");
  if (!journalId || !creditId) return { ok: false, message: "Missing credit." };

  const supabase = await createClient();
  const { error } = await supabase.from("journal_credits").delete().eq("id", creditId);

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "That credit could not be removed." };
  }

  revalidatePath(`/admin/journals/${journalId}`);
  return { ok: true, message: "Credit removed." };
}

// -----------------------------------------------------------------------------
// Assets
// -----------------------------------------------------------------------------

/**
 * Upload a cover or the final PDF.
 *
 * The storage path is scoped to the journal, which is what the policy checks —
 * and it refuses entirely once the journal is published.
 *
 * A superseded file is removed after the new one is recorded. This is the same
 * pattern used for profile photographs in Phase 3, and it keeps the known
 * orphan problem from growing here: the bucket does not accumulate every cover
 * a journal has ever had.
 */
export async function uploadJournalAsset(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  await requireLeadership();

  const journalId = String(formData.get("journal_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const file = formData.get("file");

  if (!journalId || !["cover", "pdf"].includes(kind)) {
    return { ok: false, message: "Missing upload." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }

  const isCover = kind === "cover";
  const bucket = isCover ? "journal-covers" : "journal-pdfs";
  const column = isCover ? "cover_path" : "pdf_path";

  if (isCover && !COVER_TYPES.includes(file.type)) {
    return { ok: false, message: "The cover must be a JPEG, PNG or WebP image." };
  }
  if (!isCover && file.type !== "application/pdf") {
    return { ok: false, message: "The journal file must be a PDF." };
  }
  if (file.size > (isCover ? MAX_COVER : MAX_PDF)) {
    return {
      ok: false,
      message: isCover ? "Covers must be under 10 MB." : "The PDF must be under 100 MB.",
    };
  }

  const supabase = await createClient();
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
  const path = `${journalId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("journal asset upload failed:", uploadError.message);
    return {
      ok: false,
      message:
        "That file could not be uploaded. A published journal's files cannot be replaced.",
    };
  }

  const { data: current } = await supabase
    .from("journals")
    .select(column)
    .eq("id", journalId)
    .maybeSingle();

  const { error } = await supabase
    .from("journals")
    .update({ [column]: path })
    .eq("id", journalId);

  if (error) {
    // Leave no orphan if the record could not be updated.
    await supabase.storage.from(bucket).remove([path]);
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "That file could not be recorded." };
  }

  const previous = (current as Record<string, string | null> | null)?.[column];
  if (previous && previous !== path) {
    await supabase.storage.from(bucket).remove([previous]);
  }

  revalidatePath(`/admin/journals/${journalId}`);
  revalidatePath("/journals");
  return { ok: true, message: isCover ? "Cover uploaded." : "Journal PDF uploaded." };
}

// -----------------------------------------------------------------------------
// The approval workflow
// -----------------------------------------------------------------------------

export async function submitJournalForApproval(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  await requireLeadership();

  const id = String(formData.get("journal_id") ?? "");
  if (!id) return { ok: false, message: "Missing journal." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("journals")
    .update({ status: "pending_admin_approval" })
    .eq("id", id);

  if (error) {
    // The guard explains itself: an empty journal, or a status it cannot reach.
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "That journal could not be submitted." };
  }

  revalidatePath(`/admin/journals/${id}`);
  revalidatePath("/admin/journals");
  return { ok: true, message: "Submitted for school approval." };
}

export async function withdrawJournalSubmission(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  await requireLeadership();

  const id = String(formData.get("journal_id") ?? "");
  if (!id) return { ok: false, message: "Missing journal." };

  const supabase = await createClient();
  const { error } = await supabase.from("journals").update({ status: "draft" }).eq("id", id);

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "That submission could not be withdrawn." };
  }

  revalidatePath(`/admin/journals/${id}`);
  return { ok: true, message: "Withdrawn. You can work on it again." };
}

/**
 * Approve and publish.
 *
 * School Administration only, and the database agrees: guard_journal_publication
 * refuses publication to anyone else and refuses an empty journal to everyone.
 */
export async function publishJournal(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  const ctx = await requireSchoolAdmin();

  const id = String(formData.get("journal_id") ?? "");
  if (!id) return { ok: false, message: "Missing journal." };

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("journals")
    .update({
      status: "published",
      approved_by: ctx.userId,
      approved_at: now,
      published_at: now,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    console.error("publishJournal failed:", error.code, error.message);
    return { ok: false, message: "That journal could not be published." };
  }

  revalidatePath(`/admin/journals/${id}`);
  revalidatePath("/journals");
  revalidatePath("/research");
  return {
    ok: true,
    message: "Published. The journal and its papers are now in the public archive.",
  };
}

// -----------------------------------------------------------------------------
// Corrections
// -----------------------------------------------------------------------------

export async function recordCorrection(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  const ctx = await requireLeadership();

  const journalId = String(formData.get("journal_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  if (!journalId) return { ok: false, message: "Missing journal." };
  if (description.length < 5) {
    return { ok: false, message: "Describe what is being corrected." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("journal_corrections").insert({
    journal_id: journalId,
    description,
    recorded_by: ctx.userId,
  });

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "That correction could not be recorded." };
  }

  revalidatePath(`/admin/journals/${journalId}`);
  return {
    ok: true,
    message: "Correction recorded. It becomes public once school administration approves it.",
  };
}

export async function approveCorrection(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  const ctx = await requireSchoolAdmin();

  const journalId = String(formData.get("journal_id") ?? "");
  const correctionId = String(formData.get("correction_id") ?? "");
  if (!correctionId) return { ok: false, message: "Missing correction." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("journal_corrections")
    .update({ approved_by: ctx.userId, approved_at: new Date().toISOString() })
    .eq("id", correctionId);

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "That correction could not be approved." };
  }

  revalidatePath(`/admin/journals/${journalId}`);
  revalidatePath("/journals");
  return { ok: true, message: "Correction approved and published." };
}
