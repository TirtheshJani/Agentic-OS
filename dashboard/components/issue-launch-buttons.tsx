"use client";

import Link from "next/link";
import { useState } from "react";

// Phase 8.4 launch buttons. "Run headless" hands off to the home workbench
// by URL (the canonical run UI) — pre-fills prompt, agent, and project
// from the query string. "Open in terminal" POSTs /api/runs/terminal which
// spawns wt.exe (Windows) or osascript (macOS).
export function IssueLaunchButtons({
  taskId,
  assignee,
  prompt,
  projectSlug,
  defaultRepo,
}: {
  taskId: number;
  assignee: string;
  prompt: string;
  projectSlug?: string | null;
  // null when the assignee is "user" or the agent has no default-repo set.
  defaultRepo: string | null;
}) {
  const [terminalState, setTerminalState] = useState<
    | { kind: "idle" }
    | { kind: "busy" }
    | { kind: "ok"; runId: number }
    | { kind: "err"; message: string }
  >({ kind: "idle" });

  const canTerminal = assignee !== "user" && defaultRepo !== null;
  const terminalTip = !canTerminal
    ? assignee === "user"
      ? "terminal mode is for agent assignees only"
      : "agent has no default-repo set in agents/**/*.md"
    : `opens wt.exe in ${defaultRepo}; paste the issue body as your first message`;

  const headlessHref = (() => {
    const p = new URLSearchParams();
    p.set("prompt", prompt);
    p.set("agent", assignee);
    if (projectSlug) p.set("project", projectSlug);
    return `/?${p.toString()}`;
  })();

  const runTerminal = async () => {
    if (!canTerminal) return;
    setTerminalState({ kind: "busy" });
    try {
      const res = await fetch("/api/runs/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: assignee, taskId }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        runId?: number;
        error?: string;
      };
      if (!res.ok || typeof j.runId !== "number") {
        setTerminalState({
          kind: "err",
          message: j.error ?? `request failed (${res.status})`,
        });
        return;
      }
      setTerminalState({ kind: "ok", runId: j.runId });
    } catch (e) {
      setTerminalState({
        kind: "err",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const terminalBusy = terminalState.kind === "busy";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={headlessHref}
        className="text-xs font-mono border border-border bg-primary text-primary-foreground rounded-sm px-2 py-1"
      >
        Run headless →
      </Link>
      <button
        type="button"
        onClick={runTerminal}
        disabled={!canTerminal || terminalBusy}
        title={terminalTip}
        className="text-xs font-mono border border-border bg-card rounded-sm px-2 py-1 disabled:opacity-50"
      >
        {terminalBusy ? "opening..." : "Open in terminal"}
      </button>
      {terminalState.kind === "ok" && (
        <span className="text-xs font-mono text-muted-foreground">
          opened in terminal (run #{terminalState.runId})
        </span>
      )}
      {terminalState.kind === "err" && (
        <span className="text-xs font-mono text-[var(--danger)]">
          terminal: {terminalState.message}
        </span>
      )}
    </div>
  );
}
