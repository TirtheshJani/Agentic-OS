"use client";
import clsx from "clsx";
import type { CSSProperties } from "react";
import type { RuntimeInfo } from "@/hooks/useRuntimes";
import type { RuntimeCapabilities } from "@/lib/runtime/types";
import { runtimeTheme, runtimeAccentVars } from "@/lib/runtimeTheme";

const CAPABILITY_LABELS: Array<{ key: keyof RuntimeCapabilities; label: string }> = [
  { key: "sessionIdCapture", label: "Session ID capture" },
  { key: "sessionResume", label: "Session resume" },
  { key: "hooks", label: "Lifecycle hooks" },
  { key: "transcriptCostParsing", label: "Cost parsing" },
  { key: "externalTerminalEscape", label: "Open in terminal" },
];

const SETUP_HINTS: Record<string, string[]> = {
  "claude-code": [
    "npm install -g @anthropic-ai/claude-code",
    "Run `claude` once and log in (Claude Max plan).",
  ],
  "gemini-cli": [
    "npm install -g @google/gemini-cli",
    "Run `gemini` once and log in (Google AI Pro). Clear the first-run theme prompt.",
  ],
  "antigravity-cli": [
    "irm https://antigravity.google/cli/install.ps1 | iex",
    "Run `agy install`, then `agy` once and log in (Antigravity account).",
  ],
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 14 14" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7.5 6 10.5 11 4" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg viewBox="0 0 14 14" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 7h6" />
    </svg>
  );
}

export function RuntimeCard({ runtime, index }: { runtime: RuntimeInfo; index: number }) {
  const theme = runtimeTheme(runtime.id);
  const available = runtime.availability.available;
  const supported = CAPABILITY_LABELS.filter(({ key }) => runtime.capabilities[key]).length;
  const total = CAPABILITY_LABELS.length;

  return (
    <section
      style={{ ...runtimeAccentVars(runtime.id), animationDelay: `${index * 90}ms` } as CSSProperties}
      className={clsx(
        "rise group relative overflow-hidden rounded-card border bg-surface shadow-card",
        "border-line transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-lg",
        "hover:border-[color:var(--rt-line)]",
        !available && "opacity-[0.92]"
      )}
    >
      {/* accent spine */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[color:var(--rt)]" />
      {/* atmospheric accent wash */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-60 blur-2xl"
        style={{ background: "var(--rt-bg)" }}
      />

      <div className="relative p-5 pl-6 space-y-4">
        <header className="flex items-start gap-3">
          {/* monogram */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-[color:var(--rt-bg)] font-label text-sm font-semibold tracking-wide text-[color:var(--rt)] ring-1 ring-inset ring-[color:var(--rt-line)]">
            {theme.tag}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-semibold leading-tight text-ink truncate">{theme.label}</h2>
            </div>
            <p className="mt-0.5 text-xs leading-snug text-ink2">{theme.tagline}</p>
          </div>
          {/* availability badge */}
          {available ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-pill bg-ok-bg px-2 py-0.5 font-label text-[10px] uppercase tracking-wide text-ok">
              <span className="ao-pulse inline-block h-1.5 w-1.5 rounded-full bg-ok" />
              v{runtime.availability.version}
            </span>
          ) : (
            <span className="shrink-0 rounded-pill bg-danger-bg px-2 py-0.5 font-label text-[10px] uppercase tracking-wide text-danger">
              offline
            </span>
          )}
        </header>

        {/* capability meter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-label text-[10px] uppercase tracking-[0.16em] text-ink3">Capabilities</span>
            <span className="font-mono text-[11px] text-ink2">
              <span className="text-[color:var(--rt)]">{supported}</span> / {total}
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={clsx(
                  "h-1 flex-1 rounded-pill transition-colors",
                  i < supported ? "bg-[color:var(--rt)]" : "bg-line2"
                )}
              />
            ))}
          </div>
        </div>

        {/* capability rows */}
        <ul className="space-y-1.5">
          {CAPABILITY_LABELS.map(({ key, label }) => {
            const on = runtime.capabilities[key];
            return (
              <li key={key} className="flex items-center gap-2.5 text-sm">
                <span
                  className={clsx(
                    "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md",
                    on
                      ? "bg-[color:var(--rt)] text-white"
                      : "border border-line2 text-ink3"
                  )}
                >
                  {on ? <CheckIcon /> : <DashIcon />}
                </span>
                <span className={on ? "text-ink" : "text-ink3"}>{label}</span>
              </li>
            );
          })}
        </ul>

        {!available && (
          <div className="rounded-card border border-line bg-surface2 p-3 text-xs text-ink3 space-y-1">
            {runtime.availability.error && <p className="text-danger">{runtime.availability.error}</p>}
            <p className="font-label uppercase tracking-wide text-[10px] text-ink2">Setup</p>
            {(SETUP_HINTS[runtime.id] ?? []).map((hint, i) => (
              <p key={i} className="font-mono leading-relaxed">{hint}</p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
