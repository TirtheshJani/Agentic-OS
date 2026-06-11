// dashboard/lib/createProject/steps.ts
// Leaf module (no imports) so stream.ts can type-import it without cycles.

export const CREATE_STEPS = [
  "preflight",
  "draft",
  "resolve",
  "scaffold",
  "github",
  "register",
  "agents",
  "issues",
] as const;

export type CreateStepId = (typeof CREATE_STEPS)[number];

/** "warning" = step degraded but the pipeline continued (only `github` uses it). */
export type StepStatus = "pending" | "running" | "done" | "skipped" | "warning" | "failed";

export interface StepState {
  id: CreateStepId;
  status: StepStatus;
  detail?: string;
  error?: string;
}
