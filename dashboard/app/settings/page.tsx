"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/common/Button";
import { Field, Input } from "@/components/common/Field";
import { FeatureCard } from "@/components/settings/FeatureCard";
import { useStream } from "@/hooks/useStream";
import type { FeatureKey } from "@/lib/settings";

interface SettingsData {
  workspaceRoot: string;
  concurrency: { perProjectMax: number; globalMax: number };
  theme: "light" | "dark" | "system";
  autonomy: {
    enabled: boolean;
    llmRouting: boolean;
    schedulerEnabled: boolean;
    maxChainDepth: number;
  };
  rag: {
    embeddingProvider: "gemini" | "none";
    geminiApiKey: string;
    embeddingModel: string;
    embeddingDims: number;
    answerProvider: "gemini-cli" | "claude-cli" | "none";
  };
  lightrag: {
    baseUrl: string;
    autoIngest: boolean;
  };
  export: {
    notebookLmDir: string;
  };
  docker: {
    enabled: boolean;
    allowlist: string[];
  };
  evals: {
    judgeProvider: "inherit" | "gemini-cli" | "claude-cli" | "none";
    autoGradeEnabled: boolean;
    batchLimit: number;
  };
  features: Record<FeatureKey, boolean>;
}

interface RagStatus {
  embeddingProvider: string;
  model: string;
  dims: number;
  chunks: number;
  distinctHashes: number;
  embedded: number;
  pending: number;
  lastError: string | null;
  answerProvider: string;
}

const TABS = ["Features", "General", "Knowledge", "Docker", "Evals"] as const;
type Tab = (typeof TABS)[number];

/** Display metadata for the feature flags, grouped per the mockup. */
const FEATURE_GROUPS: Array<{ category: string; items: Array<{ key: FeatureKey; name: string; description: string }> }> = [
  {
    category: "Capture",
    items: [
      { key: "notes", name: "Notes", description: "Quick capture and vault note editing." },
      { key: "inbox", name: "Inbox", description: "Triage digests and failed-run review queue." },
    ],
  },
  {
    category: "Knowledge",
    items: [
      { key: "ask", name: "Ask Vault", description: "RAG-grounded answers with vault citations." },
      { key: "graph", name: "Knowledge Graph", description: "Wikilink graph over the vault." },
    ],
  },
  {
    category: "Learning & Research",
    items: [
      { key: "learning", name: "Learning", description: "AI tutors, topics, and spaced repetition." },
      { key: "research", name: "Research", description: "Deep research projects with cited reports." },
    ],
  },
  {
    category: "Studio",
    items: [{ key: "studio", name: "Design Studio", description: "Excalidraw canvases reviewed by issue." }],
  },
  {
    category: "Telemetry",
    items: [
      { key: "sessions", name: "Sessions", description: "CLI session index with token usage." },
      { key: "analytics", name: "Analytics", description: "Run volume, tokens, and cost estimates." },
      { key: "evals", name: "Evals", description: "Run grading with metrics and judge scores." },
    ],
  },
  {
    category: "Infrastructure",
    items: [
      { key: "docker", name: "Docker", description: "Compose stacks and container management." },
      { key: "connections", name: "Connections", description: "Provider auth status for MCP-backed skills." },
    ],
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [tab, setTab] = useState<Tab>("Features");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ragStatus, setRagStatus] = useState<RagStatus | null>(null);
  const [reindexing, setReindexing] = useState(false);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setSettings(data))
      .catch(() => undefined);
    fetch("/api/rag/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setRagStatus(data))
      .catch(() => undefined);
  }, []);

  useStream((event) => {
    if (event.kind !== "rag.embeddings") return;
    setRagStatus((s) =>
      s
        ? {
            ...s,
            embedded: event.embedded as number,
            pending: event.pending as number,
            model: event.model as string,
            lastError: (event.error as string | undefined) ?? null,
          }
        : s
    );
  });

  async function reembedAll() {
    if (!window.confirm("Delete all cached embeddings for the current model and re-embed every chunk?")) return;
    setReindexing(true);
    try {
      const res = await fetch("/api/rag/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const status = await fetch("/api/rag/status", { cache: "no-store" });
      if (status.ok) setRagStatus(await status.json());
    } catch (err) {
      setMessage(`Re-embed failed: ${(err as Error).message}`);
    } finally {
      setReindexing(false);
    }
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSettings(await res.json());
      setMessage("Saved.");
    } catch (err) {
      setMessage(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  /** Feature toggles persist immediately (no Save button round-trip). */
  async function toggleFeature(key: FeatureKey, enabled: boolean) {
    if (!settings) return;
    const features = { ...settings.features, [key]: enabled };
    setSettings({ ...settings, features });
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features }),
      });
      if (res.ok) setSettings(await res.json());
    } catch {
      // next poll restores truth
    }
  }

  if (!settings) return <main className="max-w-3xl mx-auto p-6 text-sm text-ink3">Loading settings...</main>;

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="font-display text-2xl font-semibold mb-4">Settings</h1>

      <div className="flex gap-1 border-b border-line mb-5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-3 py-2 text-sm font-label uppercase tracking-wide text-[11px] border-b-2 -mb-px transition-colors",
              tab === t ? "border-accent text-accent-ink font-semibold" : "border-transparent text-ink3 hover:text-ink"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Features" && (
        <div className="space-y-5">
          <p className="text-sm text-ink3">
            Disabled features disappear from the sidebar; their routes stay reachable by URL. Toggles save immediately.
          </p>
          {FEATURE_GROUPS.map((group) => (
            <section key={group.category}>
              <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-2">{group.category}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {group.items.map((f) => (
                  <FeatureCard
                    key={f.key}
                    name={f.name}
                    description={f.description}
                    enabled={settings.features[f.key]}
                    onToggle={(enabled) => toggleFeature(f.key, enabled)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === "General" && (
        <div className="space-y-4">
          <Field label="Workspace root" hint="Where per-issue git worktrees are created.">
            <Input
              value={settings.workspaceRoot}
              onChange={(e) => setSettings({ ...settings, workspaceRoot: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Per-project concurrency cap">
              <Input
                type="number"
                min={1}
                value={settings.concurrency.perProjectMax}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    concurrency: { ...settings.concurrency, perProjectMax: parseInt(e.target.value, 10) || 1 },
                  })
                }
              />
            </Field>
            <Field label="Global concurrency cap">
              <Input
                type="number"
                min={1}
                value={settings.concurrency.globalMax}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    concurrency: { ...settings.concurrency, globalMax: parseInt(e.target.value, 10) || 1 },
                  })
                }
              />
            </Field>
          </div>
          <Field label="Theme" hint="The header toggle writes this too; localStorage wins until the next toggle.">
            <select
              value={settings.theme}
              onChange={(e) => setSettings({ ...settings, theme: e.target.value as SettingsData["theme"] })}
              className="rounded-md border border-line2 bg-surface px-2 py-1.5 text-sm w-full"
            >
              <option value="system">system</option>
              <option value="light">light</option>
              <option value="dark">dark</option>
            </select>
          </Field>

          <section className="rounded-card border border-line p-4 space-y-3">
            <h2 className="text-sm font-semibold">Autonomy</h2>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autonomy.enabled}
                onChange={(e) => setSettings({ ...settings, autonomy: { ...settings.autonomy, enabled: e.target.checked } })}
              />
              <span>
                <span className="font-medium">Enable autonomy</span>
                <span className="text-ink3"> (kill switch: when off, no auto-routing, no scheduler, handoffs land in backlog)</span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autonomy.schedulerEnabled}
                onChange={(e) => setSettings({ ...settings, autonomy: { ...settings.autonomy, schedulerEnabled: e.target.checked } })}
              />
              <span>
                <span className="font-medium">In-dashboard scheduler</span>
                <span className="text-ink3"> (fires automations/remote/*.md crons as queued issues)</span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autonomy.llmRouting}
                onChange={(e) => setSettings({ ...settings, autonomy: { ...settings.autonomy, llmRouting: e.target.checked } })}
              />
              <span>
                <span className="font-medium">LLM routing fallback</span>
                <span className="text-ink3"> (reserved; one headless claude call when keyword routing finds nothing)</span>
              </span>
            </label>
            <Field label="Max handoff chain depth" hint="Children past this depth go to backlog instead of auto-running.">
              <Input
                type="number"
                min={1}
                value={settings.autonomy.maxChainDepth}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    autonomy: { ...settings.autonomy, maxChainDepth: parseInt(e.target.value, 10) || 1 },
                  })
                }
              />
            </Field>
          </section>
        </div>
      )}

      {tab === "Knowledge" && (
        <div className="space-y-4">
          <section className="rounded-card border border-line p-4 space-y-3">
            <h2 className="text-sm font-semibold">Vault RAG</h2>
            <Field label="Embedding provider" hint="none degrades retrieval to keyword + link-graph only.">
              <select
                value={settings.rag.embeddingProvider}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    rag: { ...settings.rag, embeddingProvider: e.target.value as SettingsData["rag"]["embeddingProvider"] },
                  })
                }
                className="rounded-md border border-line2 bg-surface px-2 py-1.5 text-sm w-full"
              >
                <option value="none">none</option>
                <option value="gemini">gemini</option>
              </select>
            </Field>
            <Field label="Gemini API key" hint="Used only for embeddings (gemini-embedding-001).">
              <Input
                type="password"
                autoComplete="off"
                value={settings.rag.geminiApiKey}
                onChange={(e) => setSettings({ ...settings, rag: { ...settings.rag, geminiApiKey: e.target.value } })}
              />
            </Field>
            <Field
              label="Answer provider"
              hint="gemini-cli bills your Google AI Pro account; claude-cli draws from the Claude Agent SDK credit pool."
            >
              <select
                value={settings.rag.answerProvider}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    rag: { ...settings.rag, answerProvider: e.target.value as SettingsData["rag"]["answerProvider"] },
                  })
                }
                className="rounded-md border border-line2 bg-surface px-2 py-1.5 text-sm w-full"
              >
                <option value="gemini-cli">gemini-cli</option>
                <option value="claude-cli">claude-cli</option>
                <option value="none">none</option>
              </select>
            </Field>
            {ragStatus && (
              <p className="text-sm text-ink3">
                Embeddings: {ragStatus.embedded}/{ragStatus.distinctHashes} chunks embedded ({ragStatus.chunks} total)
                {" · "}
                {ragStatus.model} @ {ragStatus.dims}d
                {ragStatus.lastError && <span className="text-danger"> · {ragStatus.lastError}</span>}
              </p>
            )}
            <Button onClick={reembedAll} disabled={reindexing}>
              {reindexing ? "Re-embedding..." : "Re-embed all"}
            </Button>
          </section>

          <section className="rounded-card border border-line p-4 space-y-3">
            <h2 className="text-sm font-semibold">LightRAG</h2>
            <Field label="Base URL" hint="Your local LightRAG instance.">
              <Input
                value={settings.lightrag.baseUrl}
                onChange={(e) => setSettings({ ...settings, lightrag: { ...settings.lightrag, baseUrl: e.target.value } })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={settings.lightrag.autoIngest}
                onChange={(e) =>
                  setSettings({ ...settings, lightrag: { ...settings.lightrag, autoIngest: e.target.checked } })
                }
              />
              <span>
                <span className="font-medium">Auto-ingest finished runs</span>
                <span className="text-ink3">
                  {" "}
                  (also requires lightrag-ingest: true in the project&apos;s PROJECT.md; clean exits only)
                </span>
              </span>
            </label>
          </section>

          <section className="rounded-card border border-line p-4 space-y-3">
            <h2 className="text-sm font-semibold">Export</h2>
            <Field
              label="NotebookLM export folder"
              hint='Point at a Google Drive for Desktop synced folder (e.g. G:\My Drive\NotebookLM-Inbox) so bundles appear in Drive. Empty = vault/outputs/notebooklm.'
            >
              <Input
                value={settings.export.notebookLmDir}
                onChange={(e) => setSettings({ ...settings, export: { ...settings.export, notebookLmDir: e.target.value } })}
              />
            </Field>
          </section>
        </div>
      )}

      {tab === "Docker" && (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.docker.enabled}
              onChange={(e) => setSettings({ ...settings, docker: { ...settings.docker, enabled: e.target.checked } })}
            />
            <span>
              <span className="font-medium">Enable Docker management</span>
              <span className="text-ink3"> (the /docker view talks to the local daemon)</span>
            </span>
          </label>
          <Field
            label="Compose allowlist"
            hint="Comma-separated compose project names whose start/stop/restart is permitted."
          >
            <Input
              value={settings.docker.allowlist.join(", ")}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  docker: {
                    ...settings.docker,
                    allowlist: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  },
                })
              }
            />
          </Field>
        </div>
      )}

      {tab === "Evals" && (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.evals.autoGradeEnabled}
              onChange={(e) => setSettings({ ...settings, evals: { ...settings.evals, autoGradeEnabled: e.target.checked } })}
            />
            <span>
              <span className="font-medium">Auto-grade finished runs</span>
              <span className="text-ink3"> (also requires the global autonomy switch; one judge CLI call per grade)</span>
            </span>
          </label>
          <Field label="Judge provider" hint="inherit follows the vault RAG answer provider.">
            <select
              value={settings.evals.judgeProvider}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  evals: { ...settings.evals, judgeProvider: e.target.value as SettingsData["evals"]["judgeProvider"] },
                })
              }
              className="rounded-md border border-line2 bg-surface px-2 py-1.5 text-sm w-full"
            >
              <option value="inherit">inherit</option>
              <option value="gemini-cli">gemini-cli</option>
              <option value="claude-cli">claude-cli</option>
              <option value="none">none</option>
            </select>
          </Field>
          <Field label="Batch limit" hint="Max runs graded per auto-grade pass.">
            <Input
              type="number"
              min={1}
              value={settings.evals.batchLimit}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  evals: { ...settings.evals, batchLimit: parseInt(e.target.value, 10) || 1 },
                })
              }
            />
          </Field>
        </div>
      )}

      {tab !== "Features" && (
        <div className="flex items-center gap-3 mt-5">
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          {message && <span className="text-sm text-ink3">{message}</span>}
        </div>
      )}
    </main>
  );
}
