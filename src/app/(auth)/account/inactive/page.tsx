import Link from "next/link";

import { getSessionContext } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { redirect } from "next/navigation";

export const metadata = { title: "Account unavailable" };

/**
 * Where a correctly signed-in but unusable account lands.
 *
 * Suspended and alumni accounts are NOT sent to the login page: they are signed
 * in, and telling them to sign in again would be both wrong and maddening.
 */
export default async function InactiveAccountPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login/student");
  if (ctx.isActive) redirect("/dashboard");

  const copy =
    ctx.status === "suspended"
      ? {
          heading: "Your account is suspended",
          body: "Your account has been suspended by school administration. Your research and authorship remain safely on record. Please speak to the Research Cell or school administration if you think this is a mistake.",
        }
      : ctx.status === "alumni"
        ? {
            heading: "Your account is an alumni account",
            body: "Your published research and authorship remain permanently part of the archive. Alumni accounts do not currently have access to the student portal.",
          }
        : {
            heading: "Your account is not yet active",
            body: "Your account has been submitted for approval and is not yet available. You will receive an email once school administration has reviewed your registration.",
          };

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-6 shadow-sm sm:p-8">
      <h1 className="font-heading text-2xl font-extrabold text-ink-strong">
        {copy.heading}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-body">{copy.body}</p>

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <form action={signOut}>
          <button
            type="submit"
            className="rounded bg-cell-ink px-4 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep"
          >
            Sign out
          </button>
        </form>
        <Link href="/" className="font-ui text-sm text-lgs-600 underline">
          Return to the public site
        </Link>
      </div>
    </div>
  );
}
