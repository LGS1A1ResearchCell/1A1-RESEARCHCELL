import Link from "next/link";

import { Wordmark } from "@/components/brand/Wordmark";

/**
 * Layout for the sign-in routes.
 *
 * Deliberately stripped of the main navigation: someone signing in has a single
 * task, and the section links are a distraction from it. The wordmark still
 * links home, so this is never a dead end.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-muted">
      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Wordmark compact />
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="border-t border-border-subtle bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <Link
            href="/"
            className="font-ui text-sm text-ink-muted transition-colors hover:text-lgs-600"
          >
            &larr; Back to the public site
          </Link>
        </div>
      </footer>
    </div>
  );
}
