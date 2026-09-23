"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Research management, from the CMS.
 *
 * Every action starts with requireSchoolAdmin(). That is not the security
 * boundary — Row Level Security is, and research_projects_cms_write is what
 * actually decides whether a write lands. The check here exists so an
 * unauthorised request gets a redirect instead of a confusing empty result.
 *
 * There is no submission, no confirmation and no review. A paper is a draft
 * until someone publishes it; publishing is a single field.
 */

export type ResearchFormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

const PDF_MAX_BYTES = 50 * 1024 * 1024;

/** Empty string means "not set", which is different from "unchanged". */
const text = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

// -----------------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------------

export async function createResearchDraft(
  _prev: ResearchFormState,
  formData: FormData,
): Promise<ResearchFormState> {
  await requireSchoolAdmin();

  const title = text(formData.get("title"));
  if (!title || title.length < 5) {
    return {
      ok: false,
      fieldErrors: { title: "Give the paper a title of at least 5 characters." },
    };
  }

  const supabase = await createClient();

  const { data: slug } = await supabase.rpc("generate_project_slug", {
    p_title: title,
  });

  // Created as a draft, always. Nothing is published by being written.
  const { data, error } = await supabase
    .from("research_projects")
    .insert({ title, slug, status: "draft" })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createResearchDraft:", error?.code, error?.message);
    return { ok: false, message: "That could not be created." };
  }

  revalidatePath("/admin/drafts");
  revalidatePath("/admin/research");
  redirect(`/admin/research/${data.id}`);
}

// -----------------------------------------------------------------------------
// Edit
// -----------------------------------------------------------------------------

export async function updateResearch(
  _prev: ResearchFormState,
  formData: FormData,
): Promise<ResearchFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("research_id") ?? "");
  if (!id) return { ok: false, message: "Missing paper." };

  const title = text(formData.get("title"));
  if (!title || title.length < 5) {
    return {
      ok: false,
      fieldErrors: { title: "Give the paper a title of at least 5 characters." },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("research_projects")
    .update({
      title,
      abstract: text(formData.get("abstract")),
      research_area: text(formData.get("research_area")),
      supervisor: text(formData.get("supervisor")),
      references_text: text(formData.get("references_text")),
      academic_year_id: text(formData.get("academic_year_id")),
      subject_id: text(formData.get("subject_id")),
    })
    .eq("id", id);

  if (error) {
    console.error("updateResearch:", error.code, error.message);
    return { ok: false, message: "Those changes could not be saved." };
  }

  revalidatePath(`/admin/research/${id}`);
  revalidatePath("/admin/research");
  revalidatePath("/admin/drafts");
  revalidatePath("/research");
  return { ok: true, message: "Saved." };
}

// -----------------------------------------------------------------------------
// Publish and unpublish
// -----------------------------------------------------------------------------

export async function setResearchStatus(
  _prev: ResearchFormState,
  formData: FormData,
): Promise<ResearchFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("research_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) return { ok: false, message: "Missing paper." };
  if (status !== "draft" && status !== "published") {
    return { ok: false, message: "A paper is either a draft or published." };
  }

  const supabase = await createClient();

  // published_at records when it first went public and is not cleared by
  // unpublishing: "this was published on…" stays true even if it is later
  // taken down for correction.
  const patch: Record<string, unknown> = { status };
  if (status === "published") {
    const { data: existing } = await supabase
      .from("research_projects")
      .select("published_at")
      .eq("id", id)
      .maybeSingle();
    if (!existing?.published_at) patch.published_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("research_projects")
    .update(patch)
    .eq("id", id);

  if (error) {
    console.error("setResearchStatus:", error.code, error.message);
    return { ok: false, message: "That could not be changed." };
  }

  revalidatePath(`/admin/research/${id}`);
  revalidatePath("/admin/research");
  revalidatePath("/admin/drafts");
  revalidatePath("/research");
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: status === "published" ? "Published." : "Moved back to drafts.",
  };
}

// -----------------------------------------------------------------------------
// The PDF
// -----------------------------------------------------------------------------

export async function uploadResearchPdf(
  _prev: ResearchFormState,
  formData: FormData,
): Promise<ResearchFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("research_id") ?? "");
  const file = formData.get("pdf");
  if (!id) return { ok: false, message: "Missing paper." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a PDF to upload." };
  }

  // Three separate checks, because each one alone is weak. The browser's
  // reported type and the file name are both supplied by the client and can say
  // anything; the first bytes of the file cannot.
  const looksPdfByType = file.type === "application/pdf";
  const looksPdfByName = /\.pdf$/i.test(file.name);
  const head = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString("latin1");
  const looksPdfByContent = head.startsWith("%PDF-");

  if (!looksPdfByType || !looksPdfByName || !looksPdfByContent) {
    return {
      ok: false,
      message: "That is not a PDF. Research is accepted as PDF only.",
    };
  }
  if (file.size > PDF_MAX_BYTES) {
    return { ok: false, message: "That PDF is larger than 50 MB." };
  }

  const supabase = await createClient();

  // The first path segment is the paper's id, which is what the storage policy
  // reads to decide whether the object is publicly readable.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("research-submissions")
    .upload(path, file, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    console.error("uploadResearchPdf:", uploadError.message);
    return { ok: false, message: "That PDF could not be uploaded." };
  }

  const { error } = await supabase
    .from("research_projects")
    .update({
      pdf_path: path,
      pdf_filename: file.name,
      pdf_size_bytes: file.size,
    })
    .eq("id", id);

  if (error) {
    console.error("uploadResearchPdf record:", error.code, error.message);
    return { ok: false, message: "The PDF uploaded but could not be recorded." };
  }

  revalidatePath(`/admin/research/${id}`);
  revalidatePath("/research");
  return { ok: true, message: "PDF uploaded." };
}

// -----------------------------------------------------------------------------
// Authors
// -----------------------------------------------------------------------------

export async function addResearchAuthor(
  _prev: ResearchFormState,
  formData: FormData,
): Promise<ResearchFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("research_id") ?? "");
  const fullName = text(formData.get("full_name"));
  const kindRaw = String(formData.get("kind") ?? "student");
  const kind = ["student", "faculty", "external"].includes(kindRaw) ? kindRaw : "student";

  if (!id) return { ok: false, message: "Missing paper." };
  if (!fullName) {
    return { ok: false, fieldErrors: { full_name: "Enter the author's name." } };
  }

  const supabase = await createClient();

  // An author is a person in the record, not an account. Reuse an existing
  // person where the name already matches exactly, so adding the same author to
  // a second paper does not duplicate them.
  const { data: existing } = await supabase
    .from("people")
    .select("id")
    .eq("full_name", fullName)
    .limit(1)
    .maybeSingle();

  let personId = existing?.id as string | undefined;

  if (!personId) {
    const { data: slug } = await supabase.rpc("generate_person_slug", {
      p_full_name: fullName,
    });
    // is_public defaults to false. Naming someone as an author records them;
    // it does not put them on the public People page.
    const { data: created, error: personError } = await supabase
      .from("people")
      .insert({ full_name: fullName, slug, kind })
      .select("id")
      .single();
    if (personError || !created) {
      console.error("addResearchAuthor person:", personError?.code, personError?.message);
      return { ok: false, message: "That author could not be added." };
    }
    personId = created.id;
  }

  const { count } = await supabase
    .from("research_authors")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id);

  const { error } = await supabase.from("research_authors").insert({
    project_id: id,
    person_id: personId,
    author_role: "co_author",
    author_order: count ?? 0,
    confirmation_status: "confirmed",
    confirmed_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "That author is already on this paper." };
    }
    console.error("addResearchAuthor:", error.code, error.message);
    return { ok: false, message: "That author could not be added." };
  }

  revalidatePath(`/admin/research/${id}`);
  revalidatePath("/research");
  return { ok: true, message: `${fullName} added.` };
}

export async function removeResearchAuthor(
  _prev: ResearchFormState,
  formData: FormData,
): Promise<ResearchFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("research_id") ?? "");
  const authorId = String(formData.get("author_id") ?? "");
  if (!id || !authorId) return { ok: false, message: "Missing author." };

  const supabase = await createClient();
  // Only the authorship is removed. The person stays in the record, because
  // they may be an author on other papers.
  const { error } = await supabase.from("research_authors").delete().eq("id", authorId);

  if (error) {
    console.error("removeResearchAuthor:", error.code, error.message);
    return { ok: false, message: "That author could not be removed." };
  }

  revalidatePath(`/admin/research/${id}`);
  revalidatePath("/research");
  return { ok: true, message: "Author removed." };
}

// -----------------------------------------------------------------------------
// Reading a PDF
// -----------------------------------------------------------------------------

/**
 * A time-limited URL for a paper's PDF.
 *
 * The bucket is private. Anonymous visitors can read the objects belonging to
 * published papers — that is what "published research pdfs are readable"
 * allows — so this succeeds for published research and fails for a draft,
 * decided by the database rather than by this function.
 */
export async function researchPdfUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("research-submissions")
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}
