"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/brand/Wordmark";

const NAV = [
  { href: "/research", label: "Research" },
  { href: "/journals", label: "Journals" },
  { href: "/people", label: "People" },
  { href: "/about", label: "About" },
  { href: "/resources", label: "Resources" },
] as const;

/**
 * Public site header.
 *
 * The two login entries are labelled "Student Login" and "Admin Login"
 * explicitly, never "Students" or "Admin" — the label states the action, so a
 * visitor is never unsure whether a link leads to a public page or a sign-in.
 *
 * The mobile layout is a genuine panel rather than a narrowed desktop bar: the
 * section links stack at full tap size and the two login entries are separated
 * out below them, because on a phone they are the most likely destination.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Escape closes the panel, which keyboard users will expect.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6">
        <Wordmark />

        {/* Desktop navigation */}
        <nav
          aria-label="Main"
          className="hidden items-center gap-1 lg:flex"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`rounded px-3 py-2 font-ui text-sm transition-colors ${
                isActive(item.href)
                  ? "text-lgs-600 font-semibold"
                  : "text-ink-body hover:text-lgs-600"
              }`}
            >
              {item.label}
            </Link>
          ))}

          <span
            aria-hidden="true"
            className="mx-2 h-5 w-px bg-border-subtle"
          />

          <Link
            href="/login/student"
            className="rounded border border-lgs-500 px-3.5 py-2 font-ui text-sm font-medium text-lgs-600 transition-colors hover:bg-lgs-50"
          >
            Student Login
          </Link>
          <Link
            href="/login/admin"
            className="ml-2 rounded bg-cell-ink px-3.5 py-2 font-ui text-sm font-medium text-white transition-colors hover:bg-cell-ink-deep"
          >
            Admin Login
          </Link>
        </nav>

        {/* Mobile trigger */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="-mr-2 inline-flex items-center justify-center rounded p-2 text-ink-strong lg:hidden"
        >
          <span className="sr-only">
            {open ? "Close menu" : "Open menu"}
          </span>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {open ? (
              <>
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </>
            ) : (
              <>
                <path d="M3.5 7h17" />
                <path d="M3.5 12h17" />
                <path d="M3.5 17h17" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile panel */}
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          /* Any activation inside the panel dismisses it. Handling it here
             rather than in an effect on `pathname` avoids a cascading render,
             and still covers keyboard activation, since Enter on a link fires
             a click. */
          onClick={() => setOpen(false)}
          className="border-t border-border-subtle bg-surface lg:hidden"
        >
          <ul className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`block border-b border-border-subtle py-3.5 font-ui text-[15px] ${
                    isActive(item.href)
                      ? "text-lgs-600 font-semibold"
                      : "text-ink-body"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mx-auto grid max-w-6xl gap-2 px-4 pt-1 pb-4 sm:px-6">
            <Link
              href="/login/student"
              className="rounded border border-lgs-500 px-4 py-3 text-center font-ui text-sm font-medium text-lgs-600"
            >
              Student Login
            </Link>
            <Link
              href="/login/admin"
              className="rounded bg-cell-ink px-4 py-3 text-center font-ui text-sm font-medium text-white"
            >
              Admin Login
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
