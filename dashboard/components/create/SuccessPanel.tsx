"use client";
import Link from "next/link";
import type { CreateJob } from "@/lib/createProject/jobs";
import { Button } from "@/components/common/Button";

export function SuccessPanel({ job, onReset }: { job: CreateJob; onReset: () => void }) {
  const r = job.result;
  const failedStep = job.steps.find((s) => s.status === "failed");
  const completed = job.steps.filter((s) => s.status === "done" || s.status === "warning");

  if (job.status === "failed") {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4">
          <p className="text-sm font-medium text-danger">
            Create failed at: {failedStep?.id ?? "unknown step"}
          </p>
          {failedStep?.error && (
            <p className="text-xs text-danger mt-1 whitespace-pre-wrap break-words">
              {failedStep.error}
            </p>
          )}
        </div>
        <div className="text-sm text-ink2 space-y-1">
          <p className="font-medium">Nothing is rolled back. What may already exist:</p>
          <ul className="list-disc ml-5 text-xs space-y-0.5 text-ink2">
            <li>{completed.length} completed step(s): {completed.map((s) => s.id).join(", ") || "none"}</li>
            {r.projectPath && <li>Local folder: {r.projectPath}</li>}
            {r.projectSlug && <li>Vault entry: vault/projects/{r.projectSlug}/PROJECT.md</li>}
            {r.agentsCreated.length > 0 && <li>Agents: {r.agentsCreated.join(", ")}</li>}
            {r.repoUrl && <li>GitHub repo: {r.repoUrl}</li>}
          </ul>
          <p className="text-xs text-ink3 pt-1">
            Deleting a GitHub repo needs the delete_repo scope
            (gh auth refresh -s delete_repo) or github.com settings.
          </p>
        </div>
        <Button variant="primary" onClick={onReset}>Start over</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-green-300 dark:border-green-900 bg-green-50 dark:bg-green-950 p-4">
        <p className="text-sm font-medium text-ok">
          Project created{r.projectSlug ? `: ${r.projectSlug}` : ""}
        </p>
        {r.projectPath && (
          <p className="text-xs text-ok mt-1">{r.projectPath}</p>
        )}
      </div>

      <ul className="text-sm space-y-1.5">
        {r.projectSlug && (
          <li>
            <Link className="text-accent hover:underline" href={`/projects/${r.projectSlug}`}>
              Open the project board
            </Link>
          </li>
        )}
        {r.repoUrl && (
          <li>
            <a className="text-accent hover:underline" href={r.repoUrl} target="_blank" rel="noreferrer">
              {r.repoUrl}
            </a>
          </li>
        )}
        <li className="text-ink2">
          Crew: {[...r.agentsCreated, ...r.agentsReused].join(", ") || "none"}{" "}
          <Link className="text-accent hover:underline" href="/agents">
            (view agents)
          </Link>
        </li>
        {r.issueIds.length > 0 && (
          <li className="text-ink2">
            {r.issueIds.length} kickoff issue(s) in the backlog{" "}
            <Link className="text-accent hover:underline" href="/issues">
              (view issues)
            </Link>
          </li>
        )}
      </ul>

      {r.warnings.length > 0 && (
        <div className="rounded-md border border-yellow-300 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950 p-3">
          <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">Warnings</p>
          <ul className="list-disc ml-4 text-xs text-yellow-700 dark:text-yellow-300 space-y-0.5">
            {r.warnings.map((w, i) => (
              <li key={i} className="break-words">{w}</li>
            ))}
          </ul>
        </div>
      )}

      <Button onClick={onReset}>Create another</Button>
    </div>
  );
}
