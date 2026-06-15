"use client";
import clsx from "clsx";
import { StatusDot } from "@/components/common/StatusDot";
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

type DotTone = "ok" | "accent" | "warn" | "danger" | "neutral";

function tone(status: StepState["status"]): { tone: DotTone; pulse: boolean } {
  switch (status) {
    case "running":
      return { tone: "accent", pulse: true };
    case "done":
      return { tone: "ok", pulse: false };
    case "warning":
      return { tone: "warn", pulse: false };
    case "failed":
      return { tone: "danger", pulse: false };
    case "skipped":
    case "pending":
    default:
      return { tone: "neutral", pulse: false };
  }
}

export function StepChecklist({ steps }: { steps: StepState[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step) => {
        const t = tone(step.status);
        return (
          <li key={step.id} className="flex items-start gap-3">
            <StatusDot tone={t.tone} pulse={t.pulse} className="mt-1.5" />
            <div className="min-w-0">
              <span
                className={clsx(
                  "text-sm",
                  step.status === "skipped" && "line-through text-ink3",
                  step.status === "pending" ? "text-ink3" : "text-ink"
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
