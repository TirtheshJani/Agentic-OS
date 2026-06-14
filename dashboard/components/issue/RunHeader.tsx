"use client";
import type { RunData } from "@/hooks/useRun";
import { useRuntime, useRuntimes } from "@/hooks/useRuntimes";
import { RuntimeBadge } from "@/components/common/RuntimeBadge";
import { StatusDot } from "@/components/common/StatusDot";
import { Button } from "@/components/common/Button";

interface Props {
  run: RunData;
  onOpenInTerminal: () => void;
}

export function RunHeader({ run, onOpenInTerminal }: Props) {
  const runtimes = useRuntimes();
  const runtime = useRuntime(run.runtimeId);
  const isActive = run.endedAt == null;
  const status = isActive
    ? "running"
    : run.exitStatus ?? (run.endedAt != null ? "ended" : "unknown");

  // While the runtimes list is loading, keep prior behavior (show the button)
  // to avoid flicker on claude runs. Once loaded, an unknown runtime id gates
  // every capability off.
  const canEscape = runtimes == null ? true : runtime?.capabilities.externalTerminalEscape === true;

  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface2 px-3 py-2 mb-2 text-xs">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex items-center gap-1.5 font-label text-[10px] uppercase tracking-wide text-ink2">
          <StatusDot tone={isActive ? "ok" : "neutral"} pulse={isActive} />
          {status}
        </span>
        <RuntimeBadge runtimeId={run.runtimeId} />
        <span className="font-mono text-ink3">#{run.id}</span>
        <span className="truncate font-mono text-ink3" title={run.worktreePath}>{run.worktreePath}</span>
        {run.ptySessionId && (
          <span className="font-mono text-ink3" title={run.ptySessionId}>session: {run.ptySessionId.slice(0, 8)}</span>
        )}
      </div>
      {canEscape && (
        <Button
          variant="secondary"
          onClick={onOpenInTerminal}
          disabled={!run.ptySessionId}
          className="shrink-0 px-2.5 py-1 text-xs"
          title={run.ptySessionId ? "Open in external terminal" : "Waiting for session ID"}
        >
          Open in terminal
        </Button>
      )}
    </div>
  );
}
