"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import { useRunState } from "@/components/run-state";

type McpServer = {
  name: string;
  source: "claude-ai" | "user-config" | "project-config" | "repo-config";
  scope: string;
  transport: "stdio" | "http" | "sse" | "managed" | "unknown";
  toolCount: number | null;
};

const SOURCE_LABEL: Record<McpServer["source"], string> = {
  "claude-ai": "CLOUD",
  "user-config": "USER",
  "project-config": "PROJECT",
  "repo-config": "REPO",
};

function isActive(server: McpServer, active: { name: string; source: string } | null): boolean {
  if (!active) return false;
  return (
    server.name.toLowerCase() === active.name.toLowerCase() && server.source === active.source
  );
}

export function IntegrationsStrip() {
  const { activeMcp } = useRunState();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mcp", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { servers: McpServer[] }) => {
        if (!cancelled) {
          setServers(j.servers ?? []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cloud = servers.filter((s) => s.source === "claude-ai");
  const local = servers.filter((s) => s.source !== "claude-ai");

  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader
        title="INTEGRATIONS · MCP"
        meta={<Pill tone={servers.length > 0 ? "good" : "muted"}>{servers.length}</Pill>}
      />
      {!loaded && <div className="text-xs text-muted-foreground mt-1">Loading…</div>}
      {loaded && servers.length === 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          No MCP servers detected.
        </div>
      )}
      {cloud.length > 0 && (
        <div className="mt-1">
          <div className="mono-label text-muted-foreground">CLOUD · CLAUDE.AI</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {cloud.map((s) => (
              <Pill
                key={`${s.source}:${s.name}`}
                tone={isActive(s, activeMcp) ? "good" : "muted"}
                glyph="◆"
              >
                {s.name.replace(/_/g, " ")}
                {isActive(s, activeMcp) ? " · ACTIVE" : ""}
              </Pill>
            ))}
          </div>
        </div>
      )}
      {local.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="mono-label text-muted-foreground">LOCAL</div>
          {local.map((s) => {
            const active = isActive(s, activeMcp);
            return (
              <div
                key={`${s.source}:${s.scope}:${s.name}`}
                className="text-xs font-mono flex items-center gap-2"
              >
                <Pill tone={active ? "good" : "muted"}>{SOURCE_LABEL[s.source]}</Pill>
                <span className="truncate" title={s.scope}>
                  {s.name}
                </span>
                {active && (
                  <Pill tone="good" className="ml-1">
                    ACTIVE
                  </Pill>
                )}
                <span className="text-muted-foreground shrink-0 ml-auto">{s.transport}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
