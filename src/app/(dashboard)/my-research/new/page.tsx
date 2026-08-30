import Link from "next/link";

import { SubmitForm } from "@/components/research/SubmitForm";
import { requireActiveAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Submit research" };

export default async function NewResearchPage() {
  await requireActiveAccount();
  const supabase = await createClient();
  const { data: subjects } = await supabase
    .from("subjects").select("id, name").order("display_order");

  return (
    <>
      <header>
        <p className="font-ui text-sm text-ink-muted">
          <Link href="/my-research" className="text-lgs-600 underline">My research</Link>
          {" / "}New submission
        </p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold text-ink-strong">
          Submit research
        </h1>
        <p className="mt-2 max-w-prose text-ink-body">
          This creates a draft. You will upload your paper and, for team
          research, add your co-authors before it goes to review.
        </p>
      </header>

      <section className="rule-notebook mt-10 max-w-2xl pt-8">
        <SubmitForm subjects={subjects ?? []} />
      </section>
    </>
  );
}
