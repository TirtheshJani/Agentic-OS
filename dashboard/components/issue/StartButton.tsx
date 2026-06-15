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
        className={busy ? "ao-sheen" : undefined}
      >
        <span className="inline-flex items-center gap-1.5">
          {busy ? (
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
              <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M4.5 3.2v9.6a.6.6 0 0 0 .92.5l7.2-4.8a.6.6 0 0 0 0-1l-7.2-4.8a.6.6 0 0 0-.92.5Z" />
            </svg>
          )}
          {busy ? "Starting..." : "Start"}
        </span>
      </Button>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
