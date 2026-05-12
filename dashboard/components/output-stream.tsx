"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

export type UsageSnapshot = {
  tokens_in?: number;
  tokens_out?: number;
  tokens_cache_read?: number;
  tokens_cache_create?: number;
  cost_usd?: number;
};

export type StreamEvent =
  | {
      type: "started";
      runId: number;
      cwd?: string;
      projectSlug?: string | null;
      activeMcp?: { name: string; source: string } | null;
      mcpStatus?: "ready" | "cloud-only" | "not-found" | null;
      requestedMcp?: string | null;
    }
  | { type: "delta"; data: string }
  | { type: "tool"; data: { name: string; input?: unknown } }
  | { type: "usage"; data: UsageSnapshot }
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
    case "started": {
      const where = e.cwd ? ` in ${e.cwd}` : "";
      const proj = e.projectSlug ? ` (project: ${e.projectSlug})` : "";
      let mcpLine = "";
      if (e.activeMcp) {
        mcpLine = `\n[mcp] ${e.activeMcp.name} (${e.activeMcp.source})\n`;
      } else if (e.mcpStatus === "cloud-only" && e.requestedMcp) {
        mcpLine = `\n[mcp] ${e.requestedMcp} is cloud-only · not bound to this run\n`;
      } else if (e.mcpStatus === "not-found" && e.requestedMcp) {
        mcpLine = `\n[mcp] ${e.requestedMcp} not found · run proceeds without it\n`;
      }
      return `[run ${e.runId} started${where}${proj}]${mcpLine}\n`;
    }
    case "delta":
      return e.data;
    case "tool":
      return `\n[tool] ${e.data.name}\n`;
    case "usage": {
      const u = e.data;
      const bits: string[] = [];
      if (u.tokens_in !== undefined) bits.push(`in=${u.tokens_in}`);
      if (u.tokens_out !== undefined) bits.push(`out=${u.tokens_out}`);
      if (u.tokens_cache_read !== undefined) bits.push(`cache_r=${u.tokens_cache_read}`);
      if (u.tokens_cache_create !== undefined) bits.push(`cache_w=${u.tokens_cache_create}`);
      if (u.cost_usd !== undefined) bits.push(`cost=$${u.cost_usd.toFixed(4)}`);
      return bits.length ? `\n[usage] ${bits.join(" ")}\n` : "";
    }
    case "done":
      return `\n[done${e.data.outputPath ? ` → ${e.data.outputPath}` : ""}]\n`;
    case "error":
      return `\n[error] ${e.data.message}\n`;
    default:
      return `\n[unknown event ${i}]\n`;
  }
}
