import Image from "next/image";
import Link from "next/link";

import lgsLogo from "@/../public/brand/lgs-logo.png";
import researchCellLogo from "@/../public/brand/research-cell-logo.jpg";

const SECTIONS = [
  {
    heading: "Explore",
    links: [
      { href: "/research", label: "Research Library" },
      { href: "/journals", label: "Journal Archive" },
      { href: "/people", label: "People" },
    ],
  },
  {
    heading: "Information",
    links: [
      { href: "/about", label: "About" },
      { href: "/resources", label: "Resources" },
    ],
  },
] as const;

/**
 * Site footer.
 *
 * Carries the dual identity at full size — the Research Cell mark on its navy
 * ground, the school crest beside the school's name — since the footer is where
 * institutional attribution properly belongs.
 *
 * The footer note is currently static. It moves to the site_content system in
 * the content phase, along with the tagline and contact details.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-border-subtle bg-surface-muted">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-3">
              <span
                className="overflow-hidden rounded-md bg-cell-ink"
                style={{ lineHeight: 0 }}
              >
                <Image
                  src={researchCellLogo}
                  alt="1A1 Research Cell"
                  width={44}
                  height={44}
                />
              </span>
              <Image
                src={lgsLogo}
                alt="Lahore Grammar School"
                width={40}
                height={40}
              />
            </div>

            <p className="mt-4 max-w-xs text-sm text-ink-muted">
              The 1A1 Research Cell is a student research body of Lahore
              Grammar School, 1-A-1 branch, Lahore.
            </p>
          </div>

          {SECTIONS.map((section) => (
            <nav key={section.heading} aria-labelledby={`f-${section.heading}`}>
              <h2
                id={`f-${section.heading}`}
                className="font-ui text-xs font-semibold tracking-widest text-ink-strong uppercase"
              >
                {section.heading}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-body transition-colors hover:text-lgs-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 border-t border-border-subtle pt-6">
          <p className="text-xs text-ink-muted">
            &copy; {year} 1A1 Research Cell, Lahore Grammar School 1-A-1.
          </p>
        </div>
      </div>
    </footer>
  );
}
