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
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runtimeId ? { issueId, runtimeId } : { issueId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onStarted();
    } catch (err) {
      setError((err as Error).message);
    } finally {
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
