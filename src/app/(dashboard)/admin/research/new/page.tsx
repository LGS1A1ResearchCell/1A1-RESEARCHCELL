import Link from "next/link";

import { NewResearchForm } from "@/components/research/NewResearchForm";
import { requireSchoolAdmin } from "@/lib/auth/session";

export const metadata = { title: "New research" };

/**
 * Creating a paper asks for the title and nothing else.
 *
 * Everything else — abstract, authors, supervisor, references, the PDF — is
 * added on the edit page afterwards. A long form at this point would suggest
 * all of it has to be ready before anything can be recorded, and the whole
 * point of drafts is that it does not.
 */
export default async function NewResearchPage() {
  await requireSchoolAdmin();

  return (
    <>
      <p className="font-ui text-sm text-ink-muted">
        <Link href="/admin/drafts" className="text-lgs-600 underline">
          Drafts
        </Link>
        {" / New"}
      </p>

      <header className="mt-4">
        <h1 className="font-heading text-3xl font-extrabold text-ink-strong">
          New research
        </h1>
        <p className="mt-2 max-w-prose text-ink-body">
          This creates a draft. Nothing is public until you publish it.
        </p>
      </header>

      <div className="mt-8 max-w-xl rounded-lg border border-border-subtle bg-surface p-5">
        <NewResearchForm />
      </div>
    </>
  );
}
