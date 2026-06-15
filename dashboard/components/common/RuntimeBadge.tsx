"use client";
import clsx from "clsx";
import { runtimeTheme, runtimeAccentVars } from "@/lib/runtimeTheme";

// Accent-tinted runtime chip. Driven by lib/runtimeTheme so every runtime
// (including antigravity, which previously fell through to a grey id) gets its
// own hue. Token-backed, so it tracks the active theme.
export function RuntimeBadge({ runtimeId, className }: { runtimeId: string; className?: string }) {
  const theme = runtimeTheme(runtimeId);
  return (
    <span
      style={runtimeAccentVars(runtimeId)}
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label uppercase tracking-wide text-[10px] whitespace-nowrap",
        "bg-[color:var(--rt-bg)] text-[color:var(--rt)]",
        className,
      )}
      title={`Runtime: ${theme.label}`}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--rt)]" />
      {theme.label}
    </span>
  );
}
