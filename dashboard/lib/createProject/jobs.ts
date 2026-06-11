// dashboard/lib/createProject/jobs.ts
// In-memory store for create-project jobs. Same dual-module-graph situation
// as liveRuns.ts: the POST route (App Router graph) starts the pipeline and
// the SSE route reads progress, so the map lives on globalThis. Jobs do not
// survive a server restart; the GET route 404s and the UI explains.
import { randomUUID } from "node:crypto";
import { CREATE_STEPS, type CreateStepId, type StepState } from "@/lib/createProject/steps";
import { publish } from "@/lib/stream";

export interface CreateJobInput {
  prompt: string;
  visibility: "private" | "public" | "local-only";
  runtimeDefault: string;
  fileIssues: boolean;
}

export interface CreateJobResult {
  projectSlug?: string;
  projectPath?: string;
  projectFilePath?: string;
  repoUrl: string | null;
  agentsCreated: string[];
  agentsReused: string[];
  issueIds: number[];
  warnings: string[];
}

export interface CreateJob {
  id: string;
  createdAt: number;
  status: "running" | "succeeded" | "failed";
  steps: StepState[];
  input: CreateJobInput;
  result: CreateJobResult;
}

const globalKey = Symbol.for("agentic-os.createProjectJobs");
const g = globalThis as unknown as Record<symbol, Map<string, CreateJob> | undefined>;
if (!g[globalKey]) {
  g[globalKey] = new Map<string, CreateJob>();
}
const jobs = g[globalKey]!;

export function createJob(input: CreateJobInput): CreateJob {
  const job: CreateJob = {
    id: randomUUID(),
    createdAt: Date.now(),
    status: "running",
    steps: CREATE_STEPS.map((id) => ({ id, status: "pending" as const })),
    input,
    result: { repoUrl: null, agentsCreated: [], agentsReused: [], issueIds: [], warnings: [] },
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): CreateJob | null {
  return jobs.get(id) ?? null;
}

export function getActiveJob(): CreateJob | null {
  for (const job of jobs.values()) {
    if (job.status === "running") return job;
  }
  return null;
}

export function updateStep(
  jobId: string,
  step: CreateStepId,
  patch: Partial<Omit<StepState, "id">>
): void {
  const job = jobs.get(jobId);
  if (!job) return;
  const state = job.steps.find((s) => s.id === step);
  if (!state) return;
  Object.assign(state, patch);
  publish({
    kind: "project.create.progress",
    jobId,
    step,
    status: state.status,
    detail: state.detail,
    error: state.error,
  });
}

export function finishJob(jobId: string, status: "succeeded" | "failed"): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = status;
  publish({ kind: "project.create.done", jobId, status });
}

export function resetJobsForTesting(): void {
  jobs.clear();
}
