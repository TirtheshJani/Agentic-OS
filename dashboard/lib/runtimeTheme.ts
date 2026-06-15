// Single source of per-runtime visual identity for the bolder agentic-os-v2 UI.
// Every surface that shows a runtime (the /runtimes cards, RuntimeBadge, run
// headers, the launch selector) pulls label + accent + tagline from here, so a
// new runtime only needs one entry. Accent values are CSS variable refs defined
// in app/globals.css (light + dark), so they stay theme-aware.
import type { CSSProperties } from "react";

export interface RuntimeTheme {
  /** Full display name. */
  label: string;
  /** Short uppercase tag for compact monograms / badges. */
  tag: string;
  /** Solid accent color (text/icon). CSS var ref. */
  accent: string;
  /** Translucent accent fill. CSS var ref. */
  accentBg: string;
  /** Translucent accent border. CSS var ref. */
  accentLine: string;
  /** One-line positioning blurb shown on the runtime card. */
  tagline: string;
}

const THEMES: Record<string, RuntimeTheme> = {
  "claude-code": {
    label: "Claude Code",
    tag: "CC",
    accent: "var(--rt-claude)",
    accentBg: "var(--rt-claude-bg)",
    accentLine: "var(--rt-claude-line)",
    tagline: "Full lifecycle engine: hooks, real session capture, cost parsing.",
  },
  "gemini-cli": {
    label: "Gemini CLI",
    tag: "GM",
    accent: "var(--rt-gemini)",
    accentBg: "var(--rt-gemini-bg)",
    accentLine: "var(--rt-gemini-line)",
    tagline: "Fast Google engine: instant session id, cwd-scoped resume.",
  },
  "antigravity-cli": {
    label: "Antigravity CLI",
    tag: "AG",
    accent: "var(--rt-agy)",
    accentBg: "var(--rt-agy-bg)",
    accentLine: "var(--rt-agy-line)",
    tagline: "Prompt-as-argv engine: one-shot launch, cwd-scoped continue.",
  },
};

const FALLBACK: RuntimeTheme = {
  label: "Runtime",
  tag: "··",
  accent: "var(--accent)",
  accentBg: "var(--accent-bg)",
  accentLine: "var(--accent-line)",
  tagline: "",
};

export function runtimeTheme(id: string): RuntimeTheme {
  const known = THEMES[id];
  if (known) return known;
  return { ...FALLBACK, label: id, tag: id.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() || "··" };
}

/** Inline style object that exposes the runtime accent as --rt / --rt-bg / --rt-line
 *  so children can use arbitrary-value utilities like text-[color:var(--rt)]. */
export function runtimeAccentVars(id: string): CSSProperties {
  const t = runtimeTheme(id);
  return {
    ["--rt" as string]: t.accent,
    ["--rt-bg" as string]: t.accentBg,
    ["--rt-line" as string]: t.accentLine,
  } as CSSProperties;
}
