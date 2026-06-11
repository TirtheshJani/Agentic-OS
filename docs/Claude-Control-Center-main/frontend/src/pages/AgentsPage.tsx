import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Plus, AlertTriangle } from 'lucide-react';
import {
  useAgentStatus,
  useAgents,
  useEnvironments,
  useSessions,
  useAgentMutations,
  useEnvironmentMutations,
  useSessionMutations,
} from '../hooks/useAgents';
import { AgentCard } from '../components/agents/AgentCard';
import { AgentForm } from '../components/agents/AgentForm';
import { EnvironmentCard } from '../components/agents/EnvironmentCard';
import { EnvironmentForm } from '../components/agents/EnvironmentForm';
import { SessionCard } from '../components/agents/SessionCard';
import { cn } from '../lib/utils';
import type { ManagedAgent, AgentEnvironment, AgentSession } from '../types';

type Tab = 'agents' | 'environments' | 'sessions';

export function AgentsPage() {
  const [tab, setTab] = useState<Tab>('agents');
  const [agentFormOpen, setAgentFormOpen] = useState(false);
  const [agentFormTarget, setAgentFormTarget] = useState<ManagedAgent | null>(null);
  const [envFormOpen, setEnvFormOpen] = useState(false);
  const [envFormTarget, setEnvFormTarget] = useState<AgentEnvironment | null>(null);

  const navigate = useNavigate();
  const { data: status } = useAgentStatus();
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: environments, isLoading: envsLoading } = useEnvironments();
  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const agentMuts = useAgentMutations();
  const envMuts = useEnvironmentMutations();
  const sessionMuts = useSessionMutations();

  const hasKey = status?.has_api_key ?? false;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'agents', label: 'Agents', count: agents?.length },
    { key: 'environments', label: 'Environments', count: environments?.length },
    { key: 'sessions', label: 'Sessions', count: sessions?.length },
  ];

  return (
    <div className="p-6 flex flex-col h-full gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bot size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Managed Agents
        </h1>
      </div>

      {/* API key warning */}
      {!hasKey && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
        >
          <AlertTriangle size={15} style={{ color: '#fbbf24' }} />
          <span className="text-xs" style={{ color: '#fbbf24' }}>
            ANTHROPIC_API_KEY not configured. Set it in backend/.env to use managed agents.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-xs font-medium transition-colors',
              tab === t.key
                ? 'border-b-2 border-accent'
                : 'hover:bg-white/[0.03]'
            )}
            style={{ color: tab === t.key ? 'var(--accent)' : 'var(--text-secondary)' }}
          >
            {t.label}
            {t.count != null && (
              <span className="ml-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                ({t.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {/* Agents tab */}
        {tab === 'agents' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => { setAgentFormTarget(null); setAgentFormOpen(true); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium hover:opacity-90 transition-all"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                <Plus size={12} />
                New Agent
              </button>
            </div>
            {agentsLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="card p-4"><div className="skeleton h-16" /></div>
                ))}
              </div>
            )}
            {!agentsLoading && agents?.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Bot size={32} style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No agents yet.</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {agents?.map((a) => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  onEdit={(agent) => { setAgentFormTarget(agent); setAgentFormOpen(true); }}
                  onDelete={(agent) => agentMuts.remove.mutate(agent.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Environments tab */}
        {tab === 'environments' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => { setEnvFormTarget(null); setEnvFormOpen(true); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium hover:opacity-90 transition-all"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                <Plus size={12} />
                New Environment
              </button>
            </div>
            {envsLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="card p-4"><div className="skeleton h-12" /></div>
                ))}
              </div>
            )}
            {!envsLoading && environments?.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No environments yet.</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {environments?.map((e) => (
                <EnvironmentCard
                  key={e.id}
                  env={e}
                  onEdit={(env) => { setEnvFormTarget(env); setEnvFormOpen(true); }}
                  onDelete={(env) => envMuts.remove.mutate(env.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Sessions tab */}
        {tab === 'sessions' && (
          <div className="space-y-3">
            {sessionsLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="card p-4"><div className="skeleton h-12" /></div>
                ))}
              </div>
            )}
            {!sessionsLoading && sessions?.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No sessions yet.</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Create an agent and environment first, then start a session.
                </p>
              </div>
            )}
            <div className="space-y-2">
              {sessions?.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onView={(session) => navigate(`/agents/sessions/${session.id}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Forms */}
      {agentFormOpen && (
        <AgentForm
          initial={agentFormTarget ?? undefined}
          isLoading={agentMuts.create.isPending || agentMuts.update.isPending}
          onCancel={() => setAgentFormOpen(false)}
          onSubmit={(data) => {
            if (agentFormTarget?.id) {
              agentMuts.update.mutate({ id: agentFormTarget.id, data }, {
                onSuccess: () => setAgentFormOpen(false),
              });
            } else {
              agentMuts.create.mutate(data, {
                onSuccess: () => setAgentFormOpen(false),
              });
            }
          }}
        />
      )}
      {envFormOpen && (
        <EnvironmentForm
          initial={envFormTarget ?? undefined}
          isLoading={envMuts.create.isPending || envMuts.update.isPending}
          onCancel={() => setEnvFormOpen(false)}
          onSubmit={(data) => {
            if (envFormTarget?.id) {
              envMuts.update.mutate({ id: envFormTarget.id, data }, {
                onSuccess: () => setEnvFormOpen(false),
              });
            } else {
              envMuts.create.mutate(data, {
                onSuccess: () => setEnvFormOpen(false),
              });
            }
          }}
        />
      )}
    </div>
  );
}
