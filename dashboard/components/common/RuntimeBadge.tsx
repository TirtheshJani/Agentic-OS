"use client";
import clsx from "clsx";

const RUNTIME_STYLES: Record<string, string> = {
  "claude-code": "bg-accent-bg text-accent-ink",
  "gemini-cli": "bg-ok-bg text-ok",
};

const RUNTIME_LABELS: Record<string, string> = {
  "claude-code": "Claude Code",
  "gemini-cli": "Gemini CLI",
};

export function RuntimeBadge({ runtimeId }: { runtimeId: string }) {
  const style = RUNTIME_STYLES[runtimeId] ?? "bg-surface2 text-ink2";
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
