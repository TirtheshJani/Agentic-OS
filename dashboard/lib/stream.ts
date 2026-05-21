export type StreamEvent =
  | { kind: "project.changed"; slug: string; reason: "create" | "update" | "delete" }
  | { kind: "agent.changed"; slug: string; reason: "create" | "update" | "delete" }
  | { kind: "issue.changed"; id: number; projectSlug: string; reason: "create" | "update" | "delete" | "status" }
  | { kind: "thread.appended"; issueId: number };

type Listener = (event: StreamEvent) => void;

const listeners = new Set<Listener>();

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
