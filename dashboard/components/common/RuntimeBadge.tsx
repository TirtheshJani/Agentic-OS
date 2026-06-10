"use client";
import clsx from "clsx";

const RUNTIME_STYLES: Record<string, string> = {
  "claude-code": "bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100",
  "gemini-cli": "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100",
};

const RUNTIME_LABELS: Record<string, string> = {
  "claude-code": "Claude Code",
  "gemini-cli": "Gemini CLI",
};

export function RuntimeBadge({ runtimeId }: { runtimeId: string }) {
  const style = RUNTIME_STYLES[runtimeId] ?? "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  const label = RUNTIME_LABELS[runtimeId] ?? runtimeId;
  return (
    <span
      className={clsx("px-1.5 py-0.5 rounded text-xs font-sans whitespace-nowrap", style)}
      title={`Runtime: ${label}`}
    >
      {label}
    </span>
  );
}
