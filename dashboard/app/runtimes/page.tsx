"use client";
import { useRuntimes } from "@/hooks/useRuntimes";
import { RuntimeBadge } from "@/components/common/RuntimeBadge";
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
      <h1 className="text-xl font-semibold mb-6">Runtimes</h1>
      {!runtimes ? (
        <p className="text-sm text-gray-400">Detecting runtimes...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {runtimes.map((rt) => (
            <section
              key={rt.id}
              className="rounded-md border border-gray-200 dark:border-gray-800 p-4 space-y-3"
            >
              <header className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RuntimeBadge runtimeId={rt.id} />
                  {rt.availability.available ? (
                    <span className="text-xs text-gray-500 font-mono">v{rt.availability.version}</span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200">
                      not available
                    </span>
                  )}
                </div>
              </header>

              <ul className="space-y-1">
                {CAPABILITY_LABELS.map(({ key, label }) => (
                  <li key={key} className="flex items-center gap-2 text-sm">
                    <span className={rt.capabilities[key] ? "text-green-600" : "text-gray-400"}>
                      {rt.capabilities[key] ? "✓" : "✗"}
                    </span>
                    <span className={rt.capabilities[key] ? "" : "text-gray-500"}>{label}</span>
                  </li>
                ))}
              </ul>

              {!rt.availability.available && (
                <div className="text-xs text-gray-500 space-y-1">
                  {rt.availability.error && <p className="text-red-600">{rt.availability.error}</p>}
                  <p className="font-medium text-gray-600 dark:text-gray-400">Setup:</p>
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
