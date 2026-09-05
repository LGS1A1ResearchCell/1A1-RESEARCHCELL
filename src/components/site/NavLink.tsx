"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";

/**
 * A navigation link that shows it has been clicked.
 *
 * The admin pages each run several queries against Supabase, and the round trip
 * is not local — a couple of seconds is normal. The App Router keeps the
 * *previous* page on screen for that whole time, so clicking "Site content"
 * looked like nothing had happened, or like the wrong page had been shown.
 *
 * useLinkStatus reports the pending state of this specific link, so the
 * feedback sits on the thing that was clicked. Deliberately not a loading.tsx:
 * that would make the segment stream, and a streamed response starts as HTTP
 * 200 before requireSchoolAdmin() gets to redirect — turning a clean 307 into
 * a 200 that carries the redirect in its payload. No data leaked either way,
 * but the crisp server-side refusal is worth keeping.
 */
function Pending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      role="status"
      aria-live="polite"
      className="ml-2 inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-lgs-500 border-t-transparent align-[-1px]"
    >
      <span className="sr-only">Loading…</span>
    </span>
  );
}

export function NavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={className}>
      {children}
      <Pending />
    </Link>
  );
}
