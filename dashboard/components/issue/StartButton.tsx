"use client";
import { useState } from "react";
import { Button } from "@/components/common/Button";

interface Props {
  issueId: number;
  disabled: boolean;
  disabledReason: string | null;
  /** Per-run runtime override; undefined means "agent default". */
  runtimeId?: string;
  onStarted: () => void;
}

export function StartButton({ issueId, disabled, disabledReason, runtimeId, onStarted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    // Hard client-side timeout so a hung server (e.g. a stalled git worktree on
    // the single-threaded backend) can never leave the button stuck on
    // "Starting..." forever — it surfaces as a visible error instead.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runtimeId ? { issueId, runtimeId } : { issueId }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onStarted();
    } catch (err) {
      const e = err as Error;
      setError(
        e.name === "AbortError"
          ? "Start timed out — the server did not respond. Check the dashboard logs."
          : e.message
      );
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }

  return (
    <div>
      <Button
        variant="primary"
        onClick={start}
        disabled={busy || disabled}
        title={disabledReason ?? undefined}
      >
        {busy ? "Starting..." : "Start"}
      </Button>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
