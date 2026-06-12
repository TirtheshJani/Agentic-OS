"use client";
import clsx from "clsx";
import type { CreateStepId, StepState } from "@/lib/createProject/steps";

const STEP_LABELS: Record<CreateStepId, string> = {
  preflight: "Checking prerequisites",
  draft: "Drafting plan (one Claude call)",
  resolve: "Resolving slug and crew",
  scaffold: "Scaffolding local repo",
  github: "Creating GitHub repo",
  register: "Registering vault project",
  agents: "Creating agent crew",
  issues: "Filing kickoff issues",
};

function glyph(status: StepState["status"]): { char: string; cls: string } {
  switch (status) {
    case "pending":
      return { char: "○", cls: "text-ink3" }; // ○
    case "running":
      return { char: "●", cls: "text-accent animate-pulse" }; // ●
    case "done":
      return { char: "✓", cls: "text-ok" }; // ✓
    case "skipped":
      return { char: "−", cls: "text-ink3" }; // −
    case "warning":
      return { char: "⚠", cls: "text-yellow-600" }; // ⚠
    case "failed":
      return { char: "✕", cls: "text-danger" }; // ✕
  }
}

export function StepChecklist({ steps }: { steps: StepState[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step) => {
        const g = glyph(step.status);
        return (
          <li key={step.id} className="flex items-start gap-3">
            <span className={clsx("w-4 text-center shrink-0 font-mono", g.cls)}>{g.char}</span>
            <div className="min-w-0">
              <span
                className={clsx(
                  "text-sm",
                  step.status === "skipped" && "line-through text-ink3",
                  step.status === "pending"
                    ? "text-ink3 dark:text-ink3"
                    : "text-ink"
                )}
              >
                {STEP_LABELS[step.id]}
              </span>
              {step.detail && (
                <p className="text-xs text-ink3 truncate">{step.detail}</p>
              )}
              {step.error && (
                <p className="text-xs text-danger break-words whitespace-pre-wrap">{step.error}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
