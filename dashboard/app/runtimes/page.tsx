"use client";
import { useRuntimes } from "@/hooks/useRuntimes";
import { RuntimeBadge } from "@/components/common/RuntimeBadge";
import { SectionHeader } from "@/components/common/SectionHeader";
import { Pill } from "@/components/common/Pill";
import type { RuntimeCapabilities } from "@/lib/runtime/types";

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
    "Run `gemini` once and log in with your Google account (AI Pro plan). Clear the first-run theme prompt; the dashboard assumes a logged-in CLI.",
  ],
};

export default function RuntimesPage() {
  const runtimes = useRuntimes();

  return (
    <main className="max-w-5xl mx-auto p-6">
      <SectionHeader
        kicker="ENGINES"
        title="Runtimes"
        description="Agent runtime CLIs detected on this machine and their capabilities."
      />
      {!runtimes ? (
        <p className="text-sm text-ink3">Detecting runtimes...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {runtimes.map((rt) => (
            <section
              key={rt.id}
              className="rounded-card border border-line bg-surface p-4 space-y-3 transition-colors hover:border-accent-line"
            >
              <header className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RuntimeBadge runtimeId={rt.id} />
                  {rt.availability.available ? (
                    <span className="text-xs text-ink3 font-mono">v{rt.availability.version}</span>
                  ) : (
                    <Pill tone="danger">not available</Pill>
                  )}
                </div>
              </header>

              <ul className="space-y-1">
                {CAPABILITY_LABELS.map(({ key, label }) => (
                  <li key={key} className="flex items-center gap-2 text-sm">
                    <span className={rt.capabilities[key] ? "text-ok" : "text-ink3"}>
                      {rt.capabilities[key] ? "✓" : "✗"}
                    </span>
                    <span className={rt.capabilities[key] ? "" : "text-ink3"}>{label}</span>
                  </li>
                ))}
              </ul>

              {!rt.availability.available && (
                <div className="text-xs text-ink3 space-y-1">
                  {rt.availability.error && <p className="text-danger">{rt.availability.error}</p>}
                  <p className="font-medium text-ink2">Setup:</p>
                  {(SETUP_HINTS[rt.id] ?? []).map((hint, i) => (
                    <p key={i} className="font-mono">{hint}</p>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
