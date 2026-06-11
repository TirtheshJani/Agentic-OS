import type { CreateStepId, StepStatus } from "@/lib/createProject/steps";

export type StreamEvent =
  | { kind: "project.changed"; slug: string; reason: "create" | "update" | "delete" }
  | { kind: "agent.changed"; slug: string; reason: "create" | "update" | "delete" }
  | { kind: "issue.changed"; id: number; projectSlug: string; reason: "create" | "update" | "delete" | "status" }
  | { kind: "thread.appended"; issueId: number }
  | { kind: "vault.indexed"; notes: number; links: number }
  | { kind: "project.create.progress"; jobId: string; step: CreateStepId; status: StepStatus; detail?: string; error?: string }
  | { kind: "project.create.done"; jobId: string; status: "succeeded" | "failed" };

type Listener = (event: StreamEvent) => void;

// Same dual-module-graph situation as liveRuns.ts: in dev, the App Router and
// the custom tsx server each load their own copy of this module. Publishes
// from one graph (e.g. PTY exit handling) must reach subscribers in the other
// (e.g. the SSE route, the auto-router), so the listener set lives on
// globalThis.
const globalKey = Symbol.for("agentic-os.streamBus");
const g = globalThis as unknown as Record<symbol, Set<Listener> | undefined>;
if (!g[globalKey]) {
  g[globalKey] = new Set<Listener>();
}
const listeners = g[globalKey]!;

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publish(event: StreamEvent): void {
  for (const l of listeners) {
    try {
      l(event);
    } catch (err) {
      console.error("[stream] listener threw:", err);
    }
  }
}

export function resetBusForTesting(): void {
  listeners.clear();
}

export function listenerCount(): number {
  return listeners.size;
}
