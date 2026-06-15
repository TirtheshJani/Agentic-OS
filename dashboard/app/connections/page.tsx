"use client";
import { useCallback, useEffect, useState } from "react";
import { Drawer } from "@/components/common/Drawer";
import { Button } from "@/components/common/Button";
import { SectionHeader } from "@/components/common/SectionHeader";
import { Pill } from "@/components/common/Pill";
import { StatusDot } from "@/components/common/StatusDot";

interface ConnectionStatus {
  id: string;
  label: string;
  status: "connected" | "not-configured" | "unavailable" | "deferred";
  detail: string;
  setup: string[];
}

const STATUS_TONES: Record<ConnectionStatus["status"], "ok" | "warn" | "danger" | "neutral"> = {
  connected: "ok",
  "not-configured": "warn",
  unavailable: "danger",
  deferred: "neutral",
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
      <SectionHeader
        kicker="INTEGRATIONS"
        title="Connections"
        description="MCP servers and external accounts available to agent runs."
      />
      {!connections ? (
        <p className="text-sm text-ink3">Checking connections...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {connections.map((c) => (
            <section
              key={c.id}
              className="rounded-card border border-line bg-surface p-4 space-y-2 transition-colors hover:border-accent-line"
            >
              <header className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-ink">{c.label}</h2>
                <Pill tone={STATUS_TONES[c.status]}>
                  <StatusDot tone={STATUS_TONES[c.status]} pulse={c.status === "connected"} />
                  {c.status}
                </Pill>
              </header>
              <p className="text-xs text-ink3">{c.detail}</p>
              {c.setup.length > 0 && (
                <ul className="text-xs text-ink3 space-y-0.5 list-disc list-inside">
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
          <p className="text-xs text-ink3 mb-2">
            JSON object mapping server name to its MCP config. One entry per account for multi-account Gmail.
            Saved to the gitignored .agentic-os/mcp/{editing}.json and injected into run worktrees of projects
            whose PROJECT.md lists <code className="font-mono">mcp-servers: [{editing}]</code>.
          </p>
          <textarea
            value={templateText}
            onChange={(e) => setTemplateText(e.target.value)}
            rows={16}
            spellCheck={false}
            className="w-full rounded-card border border-line2 bg-surface px-3 py-2 text-xs font-mono"
          />
          {saveError && <p className="text-sm text-danger mt-2">{saveError}</p>}
        </Drawer>
      )}
    </main>
  );
}
