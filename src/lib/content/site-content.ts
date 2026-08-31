import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Editable site copy.
 *
 * Read anonymously — site_content_public_read allows it, because this is the
 * public copy of the site. Nothing sensitive lives here: it holds the tagline,
 * introductions, About text and contact line, and nothing else.
 *
 * Every value the school has not yet supplied is stored as a visibly-marked
 * placeholder rather than invented wording. `isPlaceholder` lets a page decide
 * to omit a section entirely rather than print "[PLACEHOLDER …]" at a visitor,
 * which matters most for the tagline: whether the Research Cell describes
 * itself as scientific or as spanning all disciplines is still undecided, so it
 * must not be guessed at in either direction.
 */

export type SiteContent = Record<string, string | null>;

export function isPlaceholder(value: string | null | undefined): boolean {
  return !value || /^\s*\[PLACEHOLDER/i.test(value);
}

/** A value only if the school has actually supplied one. */
export function settled(value: string | null | undefined): string | null {
  return isPlaceholder(value) ? null : (value as string);
}

export async function getSiteContent(): Promise<SiteContent> {
  const supabase = await createClient();
  const { data } = await supabase.from("site_content").select("key, value");

  const out: SiteContent = {};
  for (const row of data ?? []) out[row.key] = row.value;
  return out;
}

/** Announcements currently within their display window. */
export async function getActiveAnnouncements() {
  const supabase = await createClient();
  // The date window and visibility are enforced by the read policy itself, so
  // an expired announcement disappears on its end date with no scheduled job
  // and no filtering here.
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, starts_on, ends_on")
    .order("starts_on", { ascending: false });

  return data ?? [];
}
