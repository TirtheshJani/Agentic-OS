"use client";
import { useCallback, useEffect, useState } from "react";
import { Drawer } from "@/components/common/Drawer";
import { Button } from "@/components/common/Button";
import clsx from "clsx";

interface ConnectionStatus {
  id: string;
  label: string;
  status: "connected" | "not-configured" | "unavailable" | "deferred";
  detail: string;
  setup: string[];
}

const STATUS_STYLES: Record<ConnectionStatus["status"], string> = {
  connected: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200",
  "not-configured": "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200",
  unavailable: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200",
  deferred: "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
};

const MCP_EDITABLE = new Set(["gmail", "calendar"]);

const TEMPLATE_PLACEHOLDER = `{
  "gmail-personal": {
    "command": "npx",
    "args": ["@gongrzhe/server-gmail-autoauth-mcp"]
  }
}`;

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [templateText, setTemplateText] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch("/api/connections", { cache: "no-store" });
    if (res.ok) setConnections((await res.json()).connections);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function openEditor(name: string) {
    setSaveError(null);
    const res = await fetch(`/api/mcp/${name}`, { cache: "no-store" });
    const data = res.ok ? await res.json() : { template: {} };
    const tpl = data.template ?? {};
    setTemplateText(Object.keys(tpl).length > 0 ? JSON.stringify(tpl, null, 2) : TEMPLATE_PLACEHOLDER);
    setEditing(name);
  }

  async function saveTemplate() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      const parsed = JSON.parse(templateText);
      const res = await fetch(`/api/mcp/${editing}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setEditing(null);
      reload();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6">Connections</h1>
      {!connections ? (
        <p className="text-sm text-gray-400">Checking connections...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {connections.map((c) => (
            <section key={c.id} className="rounded-md border border-gray-200 dark:border-gray-800 p-4 space-y-2">
              <header className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">{c.label}</h2>
                <span className={clsx("text-[10px] font-semibold px-2 py-0.5 rounded-full", STATUS_STYLES[c.status])}>
                  {c.status}
                </span>
              </header>
              <p className="text-xs text-gray-500">{c.detail}</p>
              {c.setup.length > 0 && (
                <ul className="text-xs text-gray-500 space-y-0.5 list-disc list-inside">
                  {c.setup.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              )}
              {MCP_EDITABLE.has(c.id) && (
                <Button variant="ghost" onClick={() => openEditor(c.id)}>
                  {c.status === "connected" ? "Edit servers" : "Configure"}
                </Button>
              )}
            </section>
          ))}
        </div>
      )}

      {editing && (
        <Drawer
          title={`MCP template: ${editing}`}
          width="lg"
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveTemplate} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </>
          }
        >
          <p className="text-xs text-gray-500 mb-2">
            JSON object mapping server name to its MCP config. One entry per account for multi-account Gmail.
            Saved to the gitignored .agentic-os/mcp/{editing}.json and injected into run worktrees of projects
            whose PROJECT.md lists <code className="font-mono">mcp-servers: [{editing}]</code>.
          </p>
          <textarea
            value={templateText}
            onChange={(e) => setTemplateText(e.target.value)}
            rows={16}
            spellCheck={false}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-xs font-mono"
          />
          {saveError && <p className="text-sm text-red-600 mt-2">{saveError}</p>}
        </Drawer>
      )}
    </main>
  );
}
