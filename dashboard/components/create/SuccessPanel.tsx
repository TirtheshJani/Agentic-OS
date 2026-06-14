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
        <div className="rounded-card border border-danger bg-danger-bg p-4">
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
      <div className="rounded-card border border-ok bg-ok-bg p-4">
        <p className="text-sm font-medium text-ok">
          Project created{r.projectSlug ? `: ${r.projectSlug}` : ""}
        </p>
        {r.projectPath && (
          <p className="text-xs text-ok mt-1 font-mono">{r.projectPath}</p>
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
            <a className="text-accent hover:underline font-mono" href={r.repoUrl} target="_blank" rel="noreferrer">
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
        <div className="rounded-card border border-warn bg-warn-bg p-3">
          <p className="text-xs font-medium text-warn mb-1 font-label uppercase tracking-wide">Warnings</p>
          <ul className="list-disc ml-4 text-xs text-warn space-y-0.5">
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
