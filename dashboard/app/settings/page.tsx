"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/common/Button";
import { Field, Input } from "@/components/common/Field";
import { useStream } from "@/hooks/useStream";

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

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
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

  if (!settings) return <main className="max-w-2xl mx-auto p-6 text-sm text-gray-400">Loading settings...</main>;

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6">Settings</h1>
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
        <Field label="Theme">
          <select
            value={settings.theme}
            onChange={(e) => setSettings({ ...settings, theme: e.target.value as SettingsData["theme"] })}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm w-full"
          >
            <option value="system">system</option>
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </Field>

        <section className="rounded-md border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <h2 className="text-sm font-semibold">Autonomy</h2>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autonomy.enabled}
              onChange={(e) => setSettings({ ...settings, autonomy: { ...settings.autonomy, enabled: e.target.checked } })}
            />
            <span>
              <span className="font-medium">Enable autonomy</span>
              <span className="text-gray-500"> (kill switch: when off, no auto-routing, no scheduler, handoffs land in backlog)</span>
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
              <span className="text-gray-500"> (fires automations/remote/*.md crons as queued issues)</span>
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
              <span className="text-gray-500"> (reserved; one headless claude call when keyword routing finds nothing)</span>
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

        <section className="rounded-md border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <h2 className="text-sm font-semibold">Knowledge / RAG</h2>
          <Field label="Embedding provider" hint="none degrades retrieval to keyword + link-graph only.">
            <select
              value={settings.rag.embeddingProvider}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  rag: { ...settings.rag, embeddingProvider: e.target.value as SettingsData["rag"]["embeddingProvider"] },
                })
              }
              className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm w-full"
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
              className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm w-full"
            >
              <option value="gemini-cli">gemini-cli</option>
              <option value="claude-cli">claude-cli</option>
              <option value="none">none</option>
            </select>
          </Field>
          {ragStatus && (
            <p className="text-sm text-gray-500">
              Embeddings: {ragStatus.embedded}/{ragStatus.distinctHashes} chunks embedded ({ragStatus.chunks} total)
              {" · "}
              {ragStatus.model} @ {ragStatus.dims}d
              {ragStatus.lastError && <span className="text-red-600"> · {ragStatus.lastError}</span>}
            </p>
          )}
          <Button onClick={reembedAll} disabled={reindexing}>
            {reindexing ? "Re-embedding..." : "Re-embed all"}
          </Button>
        </section>

        <section className="rounded-md border border-gray-200 dark:border-gray-800 p-4 space-y-3">
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
              <span className="text-gray-500">
                {" "}
                (also requires lightrag-ingest: true in the project&apos;s PROJECT.md; clean exits only)
              </span>
            </span>
          </label>
        </section>

        <section className="rounded-md border border-gray-200 dark:border-gray-800 p-4 space-y-3">
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

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          {message && <span className="text-sm text-gray-500">{message}</span>}
        </div>
      </div>
    </main>
  );
}
