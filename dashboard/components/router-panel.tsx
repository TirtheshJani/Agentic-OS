"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";

type Props = {
  running: boolean;
  onDispatch: (opts: {
    teamSlug: string;
    teamName: string;
    prompt: string;
    routeMode: "deterministic" | "llm";
    routeReason: string;
  }) => void;
};

type RouteSuccess = {
  ok: true;
  slug: string;
  name: string;
  path: string;
  source: "project" | "discovery";
  mode: "deterministic" | "llm";
  confidence: number;
  reason: string;
};

type RouteFail = {
  ok: false;
  mode: string;
  reason: string;
};

export function RouterPanel({ running, onDispatch }: Props) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "routing" }
    | { kind: "routed"; team: string; mode: string; reason: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const onSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setStatus({ kind: "routing" });
    try {
      const res = await fetch("/api/router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const body = (await res.json()) as RouteSuccess | RouteFail;
      if (!body.ok) {
        setStatus({ kind: "error", message: body.reason });
        return;
      }
      setStatus({
        kind: "routed",
        team: body.name,
        mode: body.mode,
        reason: body.reason,
      });
      onDispatch({
        teamSlug: body.slug,
        teamName: body.name,
        prompt: trimmed,
        routeMode: body.mode,
        routeReason: body.reason,
      });
      setPrompt("");
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <div className="border border-border rounded-lg bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill tone="muted">ROUTER</Pill>
          <span className="text-xs text-muted-foreground font-mono">
            global prompt → auto-dispatch
          </span>
        </div>
        {status.kind === "routed" && (
          <span className="text-xs font-mono text-muted-foreground">
            → {status.team} ({status.mode})
          </span>
        )}
        {status.kind === "routing" && (
          <span className="text-xs font-mono text-muted-foreground">routing…</span>
        )}
        {status.kind === "error" && (
          <span className="text-xs font-mono text-destructive">
            {status.message}
          </span>
        )}
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder="Describe what to do in any repo. ⌘/Ctrl+Enter to dispatch."
        rows={2}
        disabled={running || status.kind === "routing"}
        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={running || status.kind === "routing" || !prompt.trim()}
        >
          Dispatch
        </Button>
      </div>
    </div>
  );
}
