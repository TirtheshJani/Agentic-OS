"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

export type StreamEvent =
  | { type: "started"; runId: number }
  | { type: "delta"; data: string }
  | { type: "tool"; data: { name: string; input?: unknown } }
  | { type: "done"; data: { outputPath: string | null } }
  | { type: "error"; data: { message: string } };

export function OutputStream({ events }: { events: StreamEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-xs text-muted-foreground p-4">
        No output yet. Pick a skill and click Run.
      </div>
    );
  }
  return (
    <ScrollArea className="h-full" aria-live="polite">
      <pre className="text-xs font-mono whitespace-pre-wrap p-4">
        {events.map((e, i) => renderEvent(e, i)).join("")}
      </pre>
    </ScrollArea>
  );
}

function renderEvent(e: StreamEvent, i: number): string {
  switch (e.type) {
    case "started":
      return `[run ${e.runId} started]\n`;
    case "delta":
      return e.data;
    case "tool":
      return `\n[tool] ${e.data.name}\n`;
    case "done":
      return `\n[done${e.data.outputPath ? ` → ${e.data.outputPath}` : ""}]\n`;
    case "error":
      return `\n[error] ${e.data.message}\n`;
    default:
      return `\n[unknown event ${i}]\n`;
  }
}
