"use server";

import { revalidatePath } from "next/cache";

import { requireSchoolAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * The people the Research Cell lists.
 *
 * Three rules are enforced by the database rather than here, and this file
 * relies on that rather than duplicating it:
 *
 *   - Founders cannot be created, edited or deleted. There is no write policy
 *     on founding_contributors at all, and a trigger refuses edits or deletion
 *     of the person behind a founder.
 *   - A leadership title can exist only on someone whose status is leadership.
 *   - Nobody whose name is on a published paper or in a journal masthead can be
 *     deleted.
 *
 * So a bug in this file cannot produce a founder, a titled student, or a paper
 * with a missing author.
 */

export type PeopleFormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

const text = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

const STATUSES = ["student", "leadership"] as const;
type Status = (typeof STATUSES)[number];

/**
 * The academic year is stored exactly as typed.
 *
 * A member may belong to the Research Cell across two A-Level years, so
 * "2025-27" is as valid as "2025-26" and neither is parsed, split, or checked
 * against a calendar. The only thing rejected is nothing at all.
 */
function readPerson(formData: FormData) {
  const fullName = text(formData.get("full_name"));
  const statusRaw = String(formData.get("status") ?? "");
  const status = STATUSES.includes(statusRaw as Status) ? (statusRaw as Status) : null;
  const academicYear = text(formData.get("academic_year_text"));
  // A title is kept only for leadership. Sent by a student's form or crafted by
  // hand, it is discarded here and refused by the database underneath.
  const leadershipTitle = status === "leadership" ? text(formData.get("leadership_title")) : null;

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.full_name = "Enter the person's name.";
  if (!status) fieldErrors.status = "Choose whether they are a student or leadership.";
  if (!academicYear) fieldErrors.academic_year_text = "Enter the academic year, as you want it shown.";

  return { fullName, status, academicYear, leadershipTitle, fieldErrors };
}

// -----------------------------------------------------------------------------

export async function createPerson(
  _prev: PeopleFormState,
  formData: FormData,
): Promise<PeopleFormState> {
  await requireSchoolAdmin();

  const { fullName, status, academicYear, leadershipTitle, fieldErrors } = readPerson(formData);
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const supabase = await createClient();
  const { data: slug } = await supabase.rpc("generate_person_slug", {
    p_full_name: fullName,
  });

  const { error } = await supabase.from("people").insert({
    full_name: fullName,
    slug,
    kind: "student",
    status,
    academic_year_text: academicYear,
    leadership_title: leadershipTitle,
    is_public: true,
  });

  if (error) {
    console.error("createPerson:", error.code, error.message);
    if (error.code === "23514") {
      return { ok: false, message: "A leadership title can only be given to leadership." };
    }
    return { ok: false, message: "That person could not be added." };
  }

  revalidatePath("/admin/people");
  revalidatePath("/people");
  return { ok: true, message: `${fullName} added.` };
}

// -----------------------------------------------------------------------------

export async function updatePerson(
  _prev: PeopleFormState,
  formData: FormData,
): Promise<PeopleFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("person_id") ?? "");
  if (!id) return { ok: false, message: "Missing person." };

  const { fullName, status, academicYear, leadershipTitle, fieldErrors } = readPerson(formData);
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .update({
      full_name: fullName,
      status,
      academic_year_text: academicYear,
      leadership_title: leadershipTitle,
    })
    .eq("id", id);

  if (error) {
    console.error("updatePerson:", error.code, error.message);
    if (error.code === "42501") {
      return { ok: false, message: error.message };
    }
    if (error.code === "23514") {
      return { ok: false, message: "A leadership title can only be given to leadership." };
    }
    return { ok: false, message: "Those changes could not be saved." };
  }

  revalidatePath("/admin/people");
  revalidatePath("/people");
  revalidatePath("/people/past");
  return { ok: true, message: "Saved." };
}

// -----------------------------------------------------------------------------

export async function deletePerson(
  _prev: PeopleFormState,
  formData: FormData,
): Promise<PeopleFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("person_id") ?? "");
  if (!id) return { ok: false, message: "Missing person." };

  const supabase = await createClient();
  const { error } = await supabase.from("people").delete().eq("id", id);

  if (error) {
    console.error("deletePerson:", error.code, error.message);
    // The database explains exactly why in these cases, and its reason is
    // better than anything this layer could invent.
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "That person could not be removed." };
  }

  revalidatePath("/admin/people");
  revalidatePath("/people");
  revalidatePath("/people/past");
  return { ok: true, message: "Removed." };
}

// -----------------------------------------------------------------------------

/**
 * Moving someone to the past is a decision, not a consequence of the date.
 *
 * Nothing anywhere archives a person because a year rolled over. This runs when
 * a person with the shared password says so, and their academic year is left
 * exactly as it was — that string is what the past tables display.
 */
export async function movePersonToPast(
  _prev: PeopleFormState,
  formData: FormData,
): Promise<PeopleFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("person_id") ?? "");
  if (!id) return { ok: false, message: "Missing person." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .update({ moved_to_past_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("movePersonToPast:", error.code, error.message);
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "That person could not be moved." };
  }

  revalidatePath("/admin/people");
  revalidatePath("/people");
  revalidatePath("/people/past");
  return { ok: true, message: "Moved to the past." };
}

// -----------------------------------------------------------------------------

/**
 * Bringing someone back from the past.
 *
 * The counterpart to moving them there, and the reason moving is safe to offer:
 * a mis-click is a mistake, not a decision that needs a developer to undo. Their
 * academic year is untouched by both directions — the string the CMS typed is
 * the string that is stored, whichever list the person is currently in.
 */
export async function returnPersonToCurrent(
  _prev: PeopleFormState,
  formData: FormData,
): Promise<PeopleFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("person_id") ?? "");
  if (!id) return { ok: false, message: "Missing person." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .update({ moved_to_past_at: null })
    .eq("id", id);

  if (error) {
    console.error("returnPersonToCurrent:", error.code, error.message);
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "That person could not be returned." };
  }

  revalidatePath("/admin/people");
  revalidatePath("/people");
  revalidatePath("/people/past");
  return { ok: true, message: "Returned to current." };
}
