import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { useNavigate } from 'react-router-dom';
import { Plus, Bot, Trash2, Pencil, Download, UploadCloud, Globe, Terminal, Cpu, Database, ChevronDown, ChevronUp } from 'lucide-react';
import {
  fetchAgents, deleteAgent, installAgent, uninstallAgent, fetchAgentMemory,
} from '../api/agentLibrary';
import type { AgentDefinition, AgentCapability } from '../types/agentLibrary';

const CAPABILITY_LABELS: Record<AgentCapability, { label: string; icon: React.ElementType }> = {
  web_search: { label: 'Web Search', icon: Globe },
  code_exec:  { label: 'Code Exec',  icon: Cpu },
  cli:        { label: 'CLI Tools',  icon: Terminal },
  memory:     { label: 'Memory',     icon: Database },
};

function CapabilityBadge({ cap }: { cap: AgentCapability }) {
  const { label, icon: Icon } = CAPABILITY_LABELS[cap];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded"
      style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
    >
      <Icon size={11} />
      {label}
    </span>
  );
}

function InstallBadge({ label, installed }: { label: string; installed: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded"
      style={{
        background: installed ? 'var(--success-dim)' : 'var(--bg-tertiary)',
        color: installed ? 'var(--success)' : 'var(--text-tertiary)',
        border: `1px solid ${installed ? 'var(--success-border)' : 'var(--border)'}`,
      }}
    >
      {installed ? <Download size={11} /> : <UploadCloud size={11} />}
      {label}
    </span>
  );
}

function MemoryViewer({ agentId }: { agentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.agentMemory(agentId),
    queryFn: () => fetchAgentMemory(agentId),
  });

  if (isLoading) return <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>;
  if (!data?.content) return <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No memory file yet. It will be created on first install.</p>;

  return (
    <pre
      className="text-xs p-3 rounded overflow-auto"
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        maxHeight: 200,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {data.content}
    </pre>
  );
}

function AgentCard({ agent, onDelete, onInstall, onUninstall, onEdit }: {
  agent: AgentDefinition;
  onDelete: (id: string) => void;
  onInstall: (id: string) => void;
  onUninstall: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const [showMemory, setShowMemory] = useState(false);
  const hasMemory = agent.capabilities.includes('memory');

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bot size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{agent.name}</div>
            <div className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>/{agent.slug}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onEdit(agent.id)}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(agent.id)}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {agent.description && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{agent.description}</p>
      )}

      {agent.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {agent.capabilities.map((cap) => <CapabilityBadge key={cap} cap={cap} />)}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <InstallBadge label="Skill" installed={agent.installed_skill} />
        <InstallBadge label="Subagent" installed={agent.installed_subagent} />
      </div>

      <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
        {agent.installed_skill || agent.installed_subagent ? (
          <button
            onClick={() => onUninstall(agent.id)}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            Uninstall
          </button>
        ) : (
          <button
            onClick={() => onInstall(agent.id)}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Install
          </button>
        )}
        {hasMemory && (
          <button
            onClick={() => setShowMemory((v) => !v)}
            className="ml-auto flex items-center gap-1 text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Database size={11} />
            Memory
            {showMemory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
      </div>

      {hasMemory && showMemory && (
        <div>
          <MemoryViewer agentId={agent.id} />
        </div>
      )}
    </div>
  );
}

export function AgentLibraryPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: queryKeys.agentLibrary(),
    queryFn: fetchAgents,
    staleTime: 10_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAgent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.agentLibrary() }),
  });

  const installMut = useMutation({
    mutationFn: (id: string) => installAgent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.agentLibrary() }),
  });

  const uninstallMut = useMutation({
    mutationFn: (id: string) => uninstallAgent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.agentLibrary() }),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <Bot size={18} style={{ color: 'var(--accent)' }} />
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Agent Library</h1>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Persistent agents installed to ~/.claude/skills/ and ~/.claude/agents/
          </p>
        </div>
        <button
          onClick={() => navigate('/agent-library/new')}
          className="ml-auto flex items-center gap-2 px-4 py-2 text-sm rounded transition-colors"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Plus size={14} />
          Create Agent
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
        )}

        {!isLoading && agents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Bot size={40} style={{ color: 'var(--text-tertiary)' }} />
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No agents yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                Analyze your sessions and build reusable agents
              </p>
            </div>
            <button
              onClick={() => navigate('/agent-library/new')}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Plus size={14} />
              Create your first agent
            </button>
          </div>
        )}

        {agents.length > 0 && (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}
          >
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onDelete={(id) => deleteMut.mutate(id)}
                onInstall={(id) => installMut.mutate(id)}
                onUninstall={(id) => uninstallMut.mutate(id)}
                onEdit={(id) => navigate(`/agent-library/${id}/edit`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
