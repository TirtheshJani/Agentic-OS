import { Suspense } from "react";
import { CreateProjectWizard } from "@/components/create/CreateProjectWizard";

export const metadata = { title: "New Project - Agentic OS" };

export default function NewProjectPage() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-1">New Project</h1>
      <p className="text-sm text-ink2 mb-6">
        Describe the project. The orchestrator drafts a plan with one Claude call, then
        scaffolds the repo, creates the GitHub remote, registers the vault project,
        creates the agent crew, and files kickoff issues.
      </p>
      <Suspense>
        <CreateProjectWizard />
      </Suspense>
    </div>
  );
}
