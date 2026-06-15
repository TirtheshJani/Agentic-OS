import { Suspense } from "react";
import { CreateProjectWizard } from "@/components/create/CreateProjectWizard";

export const metadata = { title: "New Project - Agentic OS" };

export default function NewProjectPage() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <header className="text-center mb-8">
        <p className="font-label uppercase tracking-[0.22em] text-[10px] text-accent-ink mb-2">Orchestrator</p>
        <h1 className="font-display text-3xl font-semibold text-ink">Describe it once. It builds the rest.</h1>
        <p className="text-sm text-ink2 mt-2">
          Prompt → repo + GitHub remote + agent crew + kickoff issues. The orchestrator drafts a
          plan with one Claude call, then scaffolds and files the work.
        </p>
      </header>
      <Suspense>
        <CreateProjectWizard />
      </Suspense>
    </div>
  );
}
