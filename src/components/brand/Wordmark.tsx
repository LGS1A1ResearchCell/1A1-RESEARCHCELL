import Image from "next/image";
import Link from "next/link";

import lgsLogo from "@/../public/brand/lgs-logo.png";
import researchCellLogo from "@/../public/brand/research-cell-logo.jpg";

/**
 * The dual-logo lockup.
 *
 * Both identities appear, and neither replaces the other. The arrangement is
 * deliberate: the Research Cell mark leads because this is the Research Cell's
 * site, and the LGS crest sits alongside it under a shared rule, which reads as
 * "part of" rather than "instead of".
 *
 * The Research Cell logo is a dark-ground lockup — navy field, cyan wordmark —
 * so it is rendered on its own navy plate. Placing it directly on white would
 * show the JPEG's navy square as a hard edge against the page.
 */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group flex items-center gap-3 sm:gap-4"
      aria-label="1A1 Research Cell — home"
    >
      <span
        className="relative shrink-0 overflow-hidden rounded-md bg-cell-ink"
        style={{ lineHeight: 0 }}
      >
        <Image
          src={researchCellLogo}
          alt=""
          width={compact ? 40 : 48}
          height={compact ? 40 : 48}
          priority
          className="block"
        />
      </span>

      <span className="min-w-0">
        <span className="block font-heading text-[15px] leading-tight font-extrabold tracking-tight text-ink-strong sm:text-base">
          1A1 Research Cell
        </span>
        <span className="mt-0.5 flex items-center gap-1.5">
          <Image
            src={lgsLogo}
            alt=""
            width={16}
            height={16}
            className="block shrink-0"
          />
          <span className="truncate font-ui text-[11px] leading-tight tracking-wide text-ink-muted uppercase">
            Lahore Grammar School 1-A-1
          </span>
        </span>
      </span>
    </Link>
  );
}
