"use client";
import clsx from "clsx";
import type { RunData } from "@/hooks/useRun";

interface Props {
  run: RunData;
  onOpenInTerminal: () => void;
}

export function RunHeader({ run, onOpenInTerminal }: Props) {
  const isActive = run.endedAt == null;
  const status = isActive
    ? "running"
    : run.exitStatus ?? (run.endedAt != null ? "ended" : "unknown");

  return (
    <div className="flex items-center justify-between text-xs font-mono bg-gray-100 dark:bg-gray-900 rounded-md p-2 mb-2">
      <div className="flex items-center gap-3 min-w-0">
        <span className={clsx(
          "px-1.5 py-0.5 rounded font-sans",
          isActive ? "bg-green-200 dark:bg-green-900 text-green-900 dark:text-green-100" : "bg-gray-200 dark:bg-gray-800"
        )}>
          {status}
        </span>
        <span>#{run.id}</span>
        <span className="truncate" title={run.worktreePath}>{run.worktreePath}</span>
        {run.ptySessionId && (
          <span className="text-gray-500" title={run.ptySessionId}>session: {run.ptySessionId.slice(0, 8)}</span>
        )}
      </div>
      <button
        onClick={onOpenInTerminal}
        disabled={!run.ptySessionId}
        className={clsx(
          "text-xs px-2 py-0.5 rounded font-sans",
          run.ptySessionId
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
        )}
        title={run.ptySessionId ? "Open in external terminal" : "Waiting for session ID"}
      >
        Open in terminal
      </button>
    </div>
  );
}
