import { describe, it, expect, beforeEach } from "vitest";
import {
  createJob,
  getJob,
  getActiveJob,
  updateStep,
  finishJob,
  resetJobsForTesting,
  type CreateJobInput,
} from "@/lib/createProject/jobs";
import { CREATE_STEPS } from "@/lib/createProject/steps";
import { subscribe, resetBusForTesting, type StreamEvent } from "@/lib/stream";

const INPUT: CreateJobInput = {
  prompt: "Build a moon phase CLI",
  visibility: "private",
  runtimeDefault: "claude-code",
  fileIssues: true,
};

beforeEach(() => {
  resetJobsForTesting();
  resetBusForTesting();
});

describe("createProject jobs store", () => {
  it("initializes all steps pending and round-trips via getJob", () => {
    const job = createJob(INPUT);
    expect(job.steps).toHaveLength(CREATE_STEPS.length);
    expect(job.steps.every((s) => s.status === "pending")).toBe(true);
    expect(getJob(job.id)?.input.prompt).toBe(INPUT.prompt);
    expect(getJob("nope")).toBeNull();
  });

  it("getActiveJob enforces single-flight semantics", () => {
    expect(getActiveJob()).toBeNull();
    const job = createJob(INPUT);
    expect(getActiveJob()?.id).toBe(job.id);
    finishJob(job.id, "succeeded");
    expect(getActiveJob()).toBeNull();
  });

  it("updateStep mutates state and publishes a progress event", () => {
    const job = createJob(INPUT);
    const events: StreamEvent[] = [];
    const unsub = subscribe((e) => events.push(e));

    updateStep(job.id, "draft", { status: "running", detail: "one call" });

    const state = getJob(job.id)!.steps.find((s) => s.id === "draft")!;
    expect(state.status).toBe("running");
    expect(state.detail).toBe("one call");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "project.create.progress",
      jobId: job.id,
      step: "draft",
      status: "running",
    });
    unsub();
  });

  it("finishJob sets status and publishes done", () => {
    const job = createJob(INPUT);
    const events: StreamEvent[] = [];
    const unsub = subscribe((e) => events.push(e));

    finishJob(job.id, "failed");

    expect(getJob(job.id)?.status).toBe("failed");
    expect(events[0]).toMatchObject({ kind: "project.create.done", jobId: job.id, status: "failed" });
    unsub();
  });

  it("updateStep on unknown job or step is a no-op", () => {
    expect(() => updateStep("missing", "draft", { status: "done" })).not.toThrow();
    const job = createJob(INPUT);
    expect(() => updateStep(job.id, "draft", { status: "done" })).not.toThrow();
  });
});
