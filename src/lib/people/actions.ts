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

/**
 * The member_status values the database accepts. Only 'student' is written now
 * that leadership is a position rather than a kind of person; 'leadership'
 * remains in the enum because older rows may carry it and an enum value cannot
 * be removed in place.
 */
type Status = "student" | "leadership";

/**
 * The academic year is stored exactly as typed.
 *
 * A member may belong to the Research Cell across two A-Level years, so
 * "2025-27" is as valid as "2025-26" and neither is parsed, split, or checked
 * against a calendar. The only thing rejected is nothing at all.
 */
function readPerson(formData: FormData) {
  const fullName = text(formData.get("full_name"));
  const academicYear = text(formData.get("academic_year_text"));

  // Everyone added here is an ordinary member for an academic year. Leadership
  // is no longer a kind of person: it is a position held, recorded in
  // leadership_positions, so there is nothing to choose on this form.
  const status: Status = "student";
  const leadershipTitle = null;

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.full_name = "Enter the person's name.";
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

  // Only the editable fields are read here. readPerson also returns a status of
  // 'student' and a null leadership title, which are right for adding someone
  // and wrong for editing: writing them would turn whoever is named in the
  // request into a member. A person with no status is a byline on a paper, not
  // a member of the Research Cell, and editing must not be able to make them
  // one.
  const { fullName, academicYear, fieldErrors } = readPerson(formData);
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .update({
      full_name: fullName,
      academic_year_text: academicYear,
    })
    .eq("id", id)
    // The same rule as a filter, so a crafted person_id naming an author
    // reaches no row at all rather than relying on the column list alone.
    .not("status", "is", null);

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
  // One call, one transaction: every leadership position the person holds is
  // recorded in the history and vacated alongside the archive flag, or none of
  // it happens. Doing it from here as separate writes could not promise that.
  const { error } = await supabase.rpc("archive_person", { p_person: id });

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
  // Deliberately narrow: this clears the archive flag and nothing else. An
  // appointment that ended stays ended — coming back is not being reappointed.
  const { error } = await supabase.rpc("restore_person", { p_person: id });

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

// -----------------------------------------------------------------------------
// Leadership positions
// -----------------------------------------------------------------------------

/**
 * Positions are records, not labels on a person.
 *
 * Every write here goes through a database function, and that is not a style
 * choice: no client role holds INSERT, UPDATE or DELETE on either leadership
 * table, so a direct write from this file would simply be refused. The
 * functions are where the authorisation check lives and where the history of
 * an appointment is recorded, which is the whole reason the privileges were
 * taken away.
 */

const revalidateLeadership = () => {
  revalidatePath("/admin/people");
  revalidatePath("/people");
  revalidatePath("/people/past");
};

export async function createLeadershipPosition(
  _prev: PeopleFormState,
  formData: FormData,
): Promise<PeopleFormState> {
  await requireSchoolAdmin();

  const title = text(formData.get("title"));
  const order = Number(formData.get("display_order") ?? 0);
  if (!title) {
    return { ok: false, fieldErrors: { title: "Give the position a title." } };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_leadership_position", {
    p_title: title,
    p_display_order: Number.isFinite(order) ? order : 0,
  });

  if (error) {
    console.error("createLeadershipPosition:", error.code, error.message);
    if (error.code === "42501" || error.code === "22023") {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "That position could not be created." };
  }

  revalidateLeadership();
  return { ok: true, message: `${title} added.` };
}

export async function updateLeadershipPosition(
  _prev: PeopleFormState,
  formData: FormData,
): Promise<PeopleFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("position_id") ?? "");
  const title = text(formData.get("title"));
  const orderRaw = formData.get("display_order");
  const order = orderRaw === null || orderRaw === "" ? null : Number(orderRaw);
  if (!id) return { ok: false, message: "Missing position." };
  if (!title) {
    return { ok: false, fieldErrors: { title: "Give the position a title." } };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_leadership_position", {
    p_position: id,
    p_title: title,
    p_display_order: order !== null && Number.isFinite(order) ? order : null,
  });

  if (error) {
    console.error("updateLeadershipPosition:", error.code, error.message);
    if (error.code === "42501" || error.code === "22023" || error.code === "P0002") {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "That position could not be saved." };
  }

  revalidateLeadership();
  return { ok: true, message: "Saved." };
}

export async function deleteLeadershipPosition(
  _prev: PeopleFormState,
  formData: FormData,
): Promise<PeopleFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("position_id") ?? "");
  if (!id) return { ok: false, message: "Missing position." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_leadership_position", { p_position: id });

  if (error) {
    console.error("deleteLeadershipPosition:", error.code, error.message);
    // An occupied position is refused by the database, which explains why.
    if (error.code === "42501" || error.code === "P0002") {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "That position could not be removed." };
  }

  revalidateLeadership();
  return { ok: true, message: "Position removed." };
}

export async function assignLeadershipPosition(
  _prev: PeopleFormState,
  formData: FormData,
): Promise<PeopleFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("position_id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  if (!id) return { ok: false, message: "Missing position." };
  if (!personId) {
    return { ok: false, message: "Choose who holds this position." };
  }

  const supabase = await createClient();
  // The academic year is left to the database, which takes the current one.
  // It is never inferred from the person's own academic year.
  const { error } = await supabase.rpc("assign_leadership_position", {
    p_position: id,
    p_person: personId,
  });

  if (error) {
    console.error("assignLeadershipPosition:", error.code, error.message);
    if (error.code === "42501" || error.code === "22023" || error.code === "P0002") {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "That position could not be assigned." };
  }

  revalidateLeadership();
  return { ok: true, message: "Assigned." };
}

export async function vacateLeadershipPosition(
  _prev: PeopleFormState,
  formData: FormData,
): Promise<PeopleFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("position_id") ?? "");
  if (!id) return { ok: false, message: "Missing position." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("vacate_leadership_position", { p_position: id });

  if (error) {
    console.error("vacateLeadershipPosition:", error.code, error.message);
    if (error.code === "42501" || error.code === "P0002") {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "That position could not be vacated." };
  }

  revalidateLeadership();
  return { ok: true, message: "Vacated. The appointment is in the history." };
}
