"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireSchoolAdmin } from "@/lib/auth/session";

/**
 * Editable site content, announcements, resources and notifications.
 *
 * No service-role client. Site content, announcements and resources are all
 * School Administration's to manage, and the database says so: each table's
 * write policy is is_school_admin(). Marking a notification read is the
 * recipient's own act, and a trigger restricts that update to read_at alone.
 *
 * The scope of what is editable is deliberately narrow. Copy changes without a
 * redeployment; application structure does not.
 */

export type ContentFormState = { ok: boolean; message?: string };

// -----------------------------------------------------------------------------
// Site content
// -----------------------------------------------------------------------------

export async function updateSiteContent(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const ctx = await requireSchoolAdmin();

  const key = String(formData.get("key") ?? "");
  const value = String(formData.get("value") ?? "");
  if (!key) return { ok: false, message: "Missing content key." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_content")
    .update({ value: value.trim() || null, updated_by: ctx.userId })
    .eq("key", key);

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    console.error("updateSiteContent failed:", error.code, error.message);
    return { ok: false, message: "That content could not be saved." };
  }

  // Copy appears across the public site, so every page that reads it is
  // refreshed rather than only the editor.
  revalidatePath("/", "layout");
  revalidatePath("/admin/content");
  return { ok: true, message: "Saved." };
}

// -----------------------------------------------------------------------------
// Announcements
// -----------------------------------------------------------------------------

export async function saveAnnouncement(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const ctx = await requireSchoolAdmin();

  const id = String(formData.get("announcement_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const startsOn = String(formData.get("starts_on") ?? "").trim();
  const endsOn = String(formData.get("ends_on") ?? "").trim();
  const visible = String(formData.get("is_visible") ?? "") === "on";

  if (title.length < 3) return { ok: false, message: "Give the announcement a title." };
  if (startsOn && endsOn && endsOn < startsOn) {
    return { ok: false, message: "The end date cannot come before the start date." };
  }

  const supabase = await createClient();
  const row = {
    title,
    body: body || null,
    starts_on: startsOn || new Date().toISOString().slice(0, 10),
    ends_on: endsOn || null,
    is_visible: visible,
  };

  const { error } = id
    ? await supabase.from("announcements").update(row).eq("id", id)
    : await supabase.from("announcements").insert({ ...row, created_by: ctx.userId });

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    if (error.code === "23514") {
      return { ok: false, message: "The end date cannot come before the start date." };
    }
    console.error("saveAnnouncement failed:", error.code, error.message);
    return { ok: false, message: "That announcement could not be saved." };
  }

  revalidatePath("/");
  revalidatePath("/admin/announcements");
  return { ok: true, message: id ? "Announcement updated." : "Announcement created." };
}

export async function deleteAnnouncement(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("announcement_id") ?? "");
  if (!id) return { ok: false, message: "Missing announcement." };

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    return { ok: false, message: "That announcement could not be removed." };
  }

  revalidatePath("/");
  revalidatePath("/admin/announcements");
  return { ok: true, message: "Announcement removed." };
}

// -----------------------------------------------------------------------------
// Resources
// -----------------------------------------------------------------------------

export async function saveResource(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  await requireSchoolAdmin();

  const id = String(formData.get("resource_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const externalUrl = String(formData.get("external_url") ?? "").trim();
  const published = String(formData.get("is_published") ?? "") === "on";

  if (!id) return { ok: false, message: "Missing resource." };
  if (title.length < 3) return { ok: false, message: "Give the resource a title." };

  // An external link is offered to visitors, so it must be a real web address
  // rather than, say, a javascript: URL.
  if (externalUrl && !/^https?:\/\/[^\s]+$/i.test(externalUrl)) {
    return { ok: false, message: "An external link must start with http:// or https://" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("resources")
    .update({
      title,
      description: description || null,
      body: body || null,
      external_url: externalUrl || null,
      is_published: published,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "42501") return { ok: false, message: error.message };
    console.error("saveResource failed:", error.code, error.message);
    return { ok: false, message: "That resource could not be saved." };
  }

  revalidatePath("/resources");
  revalidatePath("/admin/resources");
  return { ok: true, message: published ? "Saved and published." : "Saved as a draft." };
}

