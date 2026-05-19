"use client";

import { useState } from "react";

// Phase 8.4: launch buttons on the issue detail page. "Run headless" POSTs
// the existing /api/run SSE endpoint and discards the stream — the run
// still records to `runs` and the task transitions through start/finish.
// "Open in terminal" hits /api/runs/terminal which spawns wt.exe (Windows)
// or osascript (macOS); progress is reported as a brief status line below.
//
// We deliberately do NOT pipe SSE through this component. The home page is
// the canonical UI for watching a run; this page just kicks one off.
type LaunchState =
  | { kind: "idle" }
  | { kind: "busy"; which: "headless" | "terminal" }
  | { kind: "ok"; which: "headless" | "terminal"; runId: number }
  | { kind: "err"; which: "headless" | "terminal"; message: string };

export function IssueLaunchButtons({
  taskId,
  assignee,
  prompt,
  defaultRepo,
}: {
  taskId: number;
  assignee: string;
  prompt: string;
  // null when the assignee is "user" or the agent has no default-repo set.
  defaultRepo: string | null;
}) {
  const [state, setState] = useState<LaunchState>({ kind: "idle" });

  const canTerminal = assignee !== "user" && defaultRepo !== null;
  const terminalTip = !canTerminal
    ? assignee === "user"
      ? "terminal mode is for agent assignees only"
      : "agent has no default-repo set in agents/**/*.md"
    : `opens wt.exe in ${defaultRepo}; the issue body is the first user message`;

  const runHeadless = async () => {
    setState({ kind: "busy", which: "headless" });
    try {
      // /api/run streams SSE. We POST and discard the stream — the run
      // gets inserted, finishRun is called when the stream completes
      // server-side. The home page's recent-runs card will pick it up
      // on its next refresh.
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, agent: assignee, taskId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setState({
          kind: "err",
          which: "headless",
          message: j.error ?? `request failed (${res.status})`,
        });
        return;
      }
      // Read & drop the SSE body so the connection stays open server-side
      // until the run completes. Without this the body buffer fills and
      // node closes the request, aborting the run.
      const reader = res.body?.getReader();
      let runId: number | null = null;
      if (reader) {
        const decoder = new TextDecoder();
        let buf = "";
        // Pull the first "started" frame to get runId, then keep draining.
        // We do this in the background so the button can return promptly.
        void (async () => {
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              if (runId === null) {
                const m = buf.match(/"runId":\s*(\d+)/);
                if (m) {
                  runId = Number(m[1]);
                  setState({ kind: "ok", which: "headless", runId });
                }
              }
            }
          } catch {
            // Stream aborted by navigation — fine, the server keeps going.
          }
        })();
      }
      // Hold a brief optimistic ack if we haven't parsed runId yet by the
      // time the fetch resolves. The async drainer above will overwrite
      // this with the real id when it lands.
      if (runId === null) {
        setState({ kind: "ok", which: "headless", runId: 0 });
      }
    } catch (e) {
      setState({
        kind: "err",
        which: "headless",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const runTerminal = async () => {
    if (!canTerminal) return;
    setState({ kind: "busy", which: "terminal" });
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
        setState({
          kind: "err",
          which: "terminal",
          message: j.error ?? `request failed (${res.status})`,
        });
        return;
      }
      setState({ kind: "ok", which: "terminal", runId: j.runId });
    } catch (e) {
      setState({
        kind: "err",
        which: "terminal",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const headlessBusy = state.kind === "busy" && state.which === "headless";
  const terminalBusy = state.kind === "busy" && state.which === "terminal";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={runHeadless}
        disabled={headlessBusy}
        className="text-xs font-mono border border-border bg-primary text-primary-foreground rounded-sm px-2 py-1 disabled:opacity-50"
      >
        {headlessBusy ? "starting..." : "Run headless"}
      </button>
      <button
        type="button"
        onClick={runTerminal}
        disabled={!canTerminal || terminalBusy}
        title={terminalTip}
        className="text-xs font-mono border border-border bg-card rounded-sm px-2 py-1 disabled:opacity-50"
      >
        {terminalBusy ? "opening..." : "Open in terminal"}
      </button>
      {state.kind === "ok" && (
        <span className="text-xs font-mono text-muted-foreground">
          {state.which === "terminal"
            ? `opened in terminal (run #${state.runId})`
            : state.runId > 0
              ? `started headless (run #${state.runId})`
              : "started headless"}
        </span>
      )}
      {state.kind === "err" && (
        <span className="text-xs font-mono text-[var(--danger)]">
          {state.which}: {state.message}
        </span>
      )}
    </div>
  );
}
