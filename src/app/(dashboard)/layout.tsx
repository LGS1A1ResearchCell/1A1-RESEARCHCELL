import Link from "next/link";

import { Wordmark } from "@/components/brand/Wordmark";
import { NavLink } from "@/components/site/NavLink";
import { signOut } from "@/lib/auth/actions";
import { requireSchoolAdmin } from "@/lib/auth/session";

/**
 * Shell for the private CMS.
 *
 * requireSchoolAdmin runs here, so nothing beneath this layout renders for a
 * session that is not the management account, whichever URL is tried. The proxy
 * already turned away visitors with no session at all; this is the check that
 * needs the database, and it runs only on these routes.
 *
 * There is one way to hold this session — the shared password — so the
 * navigation no longer branches by role. That branching existed to keep
 * students out of administrative pages, and there are no student accounts any
 * more.
 *
 * Denser than the public site, deliberately: the same tokens and typography,
 * but tighter, because this is a working surface rather than an archive.
 */

/**
 * The sections the school approved, in the order they approved them. Nothing
 * else belongs here — an item that is not on this list is not a CMS section.
 */
const SECTIONS = [
  { href: "/admin/research", label: "Research" },
  { href: "/admin/drafts", label: "Drafts" },
  { href: "/admin/journals", label: "Journals" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/resources", label: "Resources" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/content", label: "Site content" },
] as const;

export default async function CmsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireSchoolAdmin();

  const nav = [{ href: "/admin", label: "Overview" }, ...SECTIONS];

  return (
    <div className="flex min-h-dvh flex-col bg-surface-muted">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark compact />

          <div className="flex items-center gap-4">
            <span className="hidden font-ui text-xs text-ink-muted sm:inline">
              Management area
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded border border-border-subtle px-3 py-1.5 font-ui text-sm text-ink-body transition-colors hover:border-lgs-500 hover:text-lgs-600"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav aria-label="Management" className="border-t border-border-subtle">
          <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
            {nav.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  className="inline-block whitespace-nowrap px-3 py-3 font-ui text-sm text-ink-body transition-colors hover:text-lgs-600"
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li>
              <Link
                href="/"
                className="inline-block whitespace-nowrap px-3 py-3 font-ui text-sm text-ink-muted transition-colors hover:text-lgs-600"
              >
                Public site
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
