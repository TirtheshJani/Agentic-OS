"use client";
import { useCallback, useEffect, useState } from "react";
import { AgentCard, type AgentSummary } from "@/components/agents/AgentCard";
import { AgentEditor } from "@/components/agents/AgentEditor";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { useStream } from "@/hooks/useStream";

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentSummary[] | null>(null);
  // editor: undefined = closed, null = create mode, string = edit that slug.
  const [editor, setEditor] = useState<string | null | undefined>(undefined);

  const reload = useCallback(async () => {
    const res = await fetch("/api/agents", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setAgents(data.agents);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useStream((event) => {
    if (event.kind === "agent.changed") reload();
  });

  return (
    <main className="max-w-5xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Agents</h1>
        <Button variant="primary" onClick={() => setEditor(null)}>+ New Agent</Button>
      </header>

      {!agents ? (
        <p className="text-sm text-gray-400">Loading agents...</p>
      ) : agents.length === 0 ? (
        <EmptyState title="No agents yet" description='Click "+ New Agent" to create one, or let AI draft it from a description.' />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {agents.map((a) => (
            <AgentCard key={a.slug} agent={a} onEdit={(slug) => setEditor(slug)} />
          ))}
        </div>
      )}

      {editor !== undefined && (
        <AgentEditor
          editSlug={editor}
          onClose={() => {
            setEditor(undefined);
            reload();
          }}
        />
      )}
    </main>
  );
}
