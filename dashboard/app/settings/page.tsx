"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/common/Button";
import { Field, Input } from "@/components/common/Field";

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
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setSettings(data))
      .catch(() => undefined);
  }, []);

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
