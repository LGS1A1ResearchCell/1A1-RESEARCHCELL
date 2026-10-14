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
  // Set when the CMS has been told the name is ambiguous and has decided this
  // paper means someone new.
  const forceNew = formData.get("create_new") !== null;

  if (!id) return { ok: false, message: "Missing paper." };
  if (!fullName) {
    return { ok: false, fieldErrors: { full_name: "Enter the author's name." } };
  }

  const supabase = await createClient();

  // Everything that can be read is read before anything is written. Creating
  // the person first and then finding that the paper has gone, or that the
  // author list could not be read, would leave behind a person record that
  // belongs to no paper and that nothing in the CMS lists.
  //
  // The paper first. A missing one fails the authorship insert on its foreign
  // key, which is already past the point of no return.
  const { data: paper, error: paperError } = await supabase
    .from("research_projects")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (paperError) {
    console.error("addResearchAuthor paper:", paperError.code, paperError.message);
    return {
      ok: false,
      message:
        "This paper could not be read just now, so nothing was added. " +
        "Try again in a moment.",
    };
  }
  if (!paper) return { ok: false, message: "That paper no longer exists." };

  // Reuse is deliberately narrow.
  //
  // An author record and a People-page member are different things that happen
  // to share a table. Matching on name alone used to reach either, so naming an
  // author who happened to share a name with a member bound the paper to that
  // member — after which renaming the member silently rewrote the byline, and
  // the member could no longer be deleted because they had become an author.
  //
  // So the search is limited to rows that are not members (status is null).
  // A member with the same name is left alone and a separate author record is
  // created, which is what "papers keep their own author records" means.
  let personId: string | undefined;

  if (!forceNew) {
    // count is the true number of matching rows; the two rows fetched
    // alongside it are only there to supply an id when there is exactly one.
    // Two is enough to tell apart "none", "one" and "more than one", which is
    // the whole decision being made here.
    const { data: matches, error: lookupError, count } = await supabase
      .from("people")
      .select("id, full_name", { count: "exact" })
      .eq("full_name", fullName)
      .is("status", null)
      .limit(2);

    // A failed lookup is not an empty lookup. Treating it as one would create a
    // second record for an author who already has one, and the first sign of it
    // would be a duplicate name in a byline. There is no safe assumption to
    // make about a question the database did not answer, so nothing is written.
    if (lookupError) {
      console.error("addResearchAuthor lookup:", lookupError.code, lookupError.message);
      return {
        ok: false,
        message:
          "Existing authors could not be checked just now, so nothing was added. " +
          "Try again in a moment.",
      };
    }

    const matchCount = count ?? matches?.length ?? 0;

    if (matchCount > 1) {
      // Nothing here can tell them apart — they differ only in rows this form
      // cannot see. Picking one would attach the paper to a person chosen at
      // random, so it refuses and says so.
      return {
        ok: false,
        message:
          `There are already ${matchCount} author records named "${fullName}", and ` +
          "there is no way to tell from here which one this paper means. " +
          "Tick \u201cRecord as a new author\u201d to add a separate record for this paper.",
      };
    }

    if (matchCount === 1) {
      const only = matches?.[0]?.id as string | undefined;
      if (!only) {
        // The count says one and the row did not arrive. Reusing nothing would
        // silently create a duplicate, so this stops too.
        console.error("addResearchAuthor lookup: count 1 but no row returned");
        return {
          ok: false,
          message:
            "Existing authors could not be checked just now, so nothing was added. " +
            "Try again in a moment.",
        };
      }
      // Exactly one author record by that name: the same author on another paper.
      personId = only;
    }
  }

  // A reused record may already be an author of this paper, which the
  // (project_id, person_id) unique constraint forbids. Saying so here costs a
  // read and nothing else; the insert below still handles the same collision,
  // for a row that appears between this check and it.
  if (personId) {
    const { data: already, error: alreadyError } = await supabase
      .from("research_authors")
      .select("id")
      .eq("project_id", id)
      .eq("person_id", personId)
      .maybeSingle();

    if (alreadyError) {
      console.error("addResearchAuthor existing:", alreadyError.code, alreadyError.message);
      return {
        ok: false,
        message:
          "The author list could not be read just now, so nothing was added. " +
          "Try again in a moment.",
      };
    }
    if (already) return { ok: false, message: "That author is already on this paper." };
  }

  // Where this author goes in the byline: after the last one.
  //
  // The highest order is read rather than the rows counted. Removing an author
  // lowers the count, so a counted order would hand the next author a place
  // another author already holds, and the two would then sort against each
  // other arbitrarily in every byline.
  //
  // A failed read is not an empty paper. Falling back to 0 would put a new
  // author ahead of the first one, which is the one thing about a byline that
  // is not the CMS's to decide, so nothing is written.
  const { data: last, error: orderError } = await supabase
    .from("research_authors")
    .select("author_order")
    .eq("project_id", id)
    .order("author_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderError) {
    console.error("addResearchAuthor order:", orderError.code, orderError.message);
    return {
      ok: false,
      message:
        "The author list could not be read just now, so nothing was added. " +
        "Try again in a moment.",
    };
  }

  const lastOrder = last?.author_order;
  const nextOrder = typeof lastOrder === "number" ? lastOrder + 1 : 0;

  // Reads done. From here on, rows are written.
  //
  // Two writes remain and the database has no transaction across them from
  // here, so the second failing would leave the first behind. That window is
  // narrowed by every check above and closed by the cleanup below, but it is
  // not eliminated.
  let createdPersonId: string | undefined;

  if (!personId) {
    // The slug is read, not written, so it is checked like the reads above.
    // A null slug would be refused by the column anyway; refusing it here says
    // what actually happened instead of reporting a constraint.
    const { data: slug, error: slugError } = await supabase.rpc("generate_person_slug", {
      p_full_name: fullName,
    });
    if (slugError || !slug) {
      console.error("addResearchAuthor slug:", slugError?.code, slugError?.message);
      return {
        ok: false,
        message:
          "A record for that author could not be prepared just now, so nothing " +
          "was added. Try again in a moment.",
      };
    }
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
    createdPersonId = created.id;
  }

  const { error } = await supabase.from("research_authors").insert({
    project_id: id,
    person_id: personId,
    author_role: "co_author",
    author_order: nextOrder,
    confirmation_status: "confirmed",
    confirmed_at: new Date().toISOString(),
  });

  if (error) {
    // The person record was created a moment ago for this authorship alone, so
    // with the authorship refused it belongs to nothing. Removing it keeps a
    // failed add from leaving a name in the people table that no paper and no
    // page ever mentions.
    //
    // It is safe to attempt without further checks: the database refuses to
    // delete anyone who is an author, is credited in a journal, or is a
    // founder, so a row that turns out to be referenced after all survives
    // this. If the delete fails the add has still failed, and the only cost is
    // a record nothing points at, so the editor is told the same thing either
    // way.
    if (createdPersonId) {
      const { error: cleanupError } = await supabase
        .from("people")
        .delete()
        .eq("id", createdPersonId);
      if (cleanupError) {
        console.error(
          "addResearchAuthor cleanup:", createdPersonId,
          cleanupError.code, cleanupError.message,
        );
      }
    }

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
