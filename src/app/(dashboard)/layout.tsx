import Link from "next/link";

import { Wordmark } from "@/components/brand/Wordmark";
import { signOut } from "@/lib/auth/actions";
import { requireActiveAccount } from "@/lib/auth/session";

/**
 * Shell for every signed-in area.
 *
 * requireActiveAccount runs here, so a pending, suspended or alumni account
 * cannot reach any page beneath this layout regardless of which URL they try.
 * The proxy already turned away visitors with no session at all; this is the
 * check that needs the database, and it runs only on these routes.
 *
 * Denser than the public site, deliberately — the same tokens and typography,
 * but tighter, because this is a working surface rather than an archive.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await requireActiveAccount();

  const nav = ctx.isLeadership
    ? [
        { href: "/admin", label: "Overview" },
        ...(ctx.isSchoolAdmin
          ? [
              { href: "/admin/accounts", label: "New Student Accounts" },
              { href: "/admin/people", label: "People" },
            ]
          : []),
        { href: "/profile", label: "My profile" },
      ]
    : [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/my-research", label: "My research" },
        { href: "/my-research/new", label: "Submit research" },
        { href: "/profile", label: "My profile" },
      ];

  const roleLabel =
    ctx.role === "school_admin"
      ? "School Administration"
      : ctx.role === "leadership"
        ? "Research Cell Leadership"
        : "Student";

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
              {roleLabel}
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

        <nav aria-label="Portal" className="border-t border-border-subtle">
          <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-block whitespace-nowrap px-3 py-3 font-ui text-sm text-ink-body transition-colors hover:text-lgs-600"
                >
                  {item.label}
                </Link>
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
