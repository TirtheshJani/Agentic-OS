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
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full font-label uppercase tracking-wide text-[10px] whitespace-nowrap",
        style,
      )}
      title={`Runtime: ${label}`}
    >
      {label}
    </span>
  );
}
