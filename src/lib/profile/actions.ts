"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireActiveAccount } from "@/lib/auth/session";

/**
 * Student profile management.
 *
 * No service-role client here. A student updating their own presentation is an
 * ordinary authorised write: people_self_update permits the row, and the
 * guard_people_columns trigger restricts it to the columns they may touch. If
 * this code tried to change visibility or identity, the database would refuse
 * it — which is the point.
 *
 * Storage writes go through the same session, against the profile-photos policy
 * that scopes a student to their own person_id folder.
 */

export type ProfileFormState = {
  ok: boolean;
  message?: string;
};

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const ctx = await requireActiveAccount();
  if (!ctx.personId) {
    return { ok: false, message: "Your profile is not set up yet." };
  }

  const supabase = await createClient();

  const quote = String(formData.get("quote") ?? "").trim();
  const focalX = Number.parseFloat(String(formData.get("focal_x") ?? "0.5"));
  const focalY = Number.parseFloat(String(formData.get("focal_y") ?? "0.4"));

  if (quote.length > 500) {
    return { ok: false, message: "Please keep your quote under 500 characters." };
  }
  const clamp = (n: number, fallback: number) =>
    Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;

  const update: Record<string, unknown> = {
    quote: quote || null,
    photo_focal_x: clamp(focalX, 0.5),
    photo_focal_y: clamp(focalY, 0.4),
  };

  // ---------------------------------------------------------------------------
  // Photograph
  // ---------------------------------------------------------------------------
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!ACCEPTED.includes(photo.type)) {
      return { ok: false, message: "Please choose a JPEG, PNG or WebP image." };
    }
    if (photo.size > MAX_BYTES) {
      return { ok: false, message: "Please choose an image under 5 MB." };
    }

    // The storage policy requires the first path segment to be the caller's own
    // person_id, so a student cannot write into anyone else's folder. The
    // timestamp gives each upload a distinct name, which avoids a stale CDN copy
    // being served after a replacement.
    const path = `${ctx.personId}/${Date.now()}.${EXT[photo.type]}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(path, photo, { contentType: photo.type, upsert: false });

    if (uploadError) {
      console.error("photo upload failed:", uploadError.message);
      return { ok: false, message: "Your photograph could not be uploaded." };
    }

    // Remove the previous file so the bucket does not accumulate every
    // photograph a student has ever had.
    const { data: current } = await supabase
      .from("people")
      .select("photo_path")
      .eq("id", ctx.personId)
      .maybeSingle();

    if (current?.photo_path && current.photo_path !== path) {
      await supabase.storage.from("profile-photos").remove([current.photo_path]);
    }

    update.photo_path = path;
  }

  const { error } = await supabase
    .from("people")
    .update(update)
    .eq("id", ctx.personId);

  if (error) {
    // 42501 is the column guard: something tried to change a field the student
    // does not control. That is a bug in this action, not a user mistake.
    console.error("profile update failed:", error.code, error.message);
    return { ok: false, message: "Your profile could not be saved." };
  }

  revalidatePath("/profile");
  revalidatePath("/people");
  return { ok: true, message: "Your profile has been saved." };
}
