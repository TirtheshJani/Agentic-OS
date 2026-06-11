import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import {
  Bot, ChevronRight, Check, Globe, Cpu, Terminal, Database,
  ArrowLeft, ArrowRight, Download,
} from 'lucide-react';
import { fetchCodexCliSessions } from '../api/codexCliSessions';
import { createAgent, updateAgent, installAgent, fetchAgent, previewAgent } from '../api/agentLibrary';
import type { AgentCapability, InstallTarget, AgentDefinition } from '../types/agentLibrary';
import type { CodexCliSessionSummary } from '../api/codexCliSessions';
import { cn } from '../lib/utils';

// ─── Step indicators ────────────────────────────────────────────────────────

function StepIndicator({ step, current }: { step: number; current: number }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
        style={{
          background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--bg-tertiary)',
          color: done || active ? '#fff' : 'var(--text-tertiary)',
          border: `1px solid ${done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)'}`,
        }}
      >
        {done ? <Check size={12} /> : step}
      </div>
      <span className="text-xs" style={{ color: active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
        {['Sessions', 'Patterns', 'Configure', 'Preview'][step - 1]}
      </span>
    </div>
  );
}

// ─── Step 1: Session picker ──────────────────────────────────────────────────

function SessionPickerStep({
  selectedIds,
  onToggle,
}: {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.codexCliSessions(page, search),
    queryFn: () => fetchCodexCliSessions({ page, limit: 15, search: search || undefined, sort: 'newest' }),
    staleTime: 60_000,
  });

  const sessions = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 15);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Select sessions that represent the workflow you want to capture
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          {selectedIds.size} selected · {total} total sessions
        </p>
      </div>

      <input
        type="text"
        placeholder="Search sessions…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="w-full px-3 py-2 text-sm rounded"
        style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          outline: 'none',
        }}
      />

      {isLoading && <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>}

      <div className="flex flex-col gap-1.5" style={{ maxHeight: 380, overflowY: 'auto' }}>
        {sessions.map((s) => {
          const selected = selectedIds.has(s.session_id);
          const topTools = Object.entries(s.tool_calls).sort(([, a], [, b]) => b - a).slice(0, 3);
          return (
            <button
              key={s.session_id}
              onClick={() => onToggle(s.session_id)}
              className="w-full text-left px-3 py-2.5 rounded transition-colors"
              style={{
                background: selected ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                border: `1px solid ${selected ? 'var(--accent-border)' : 'var(--border)'}`,
              }}
            >
              <div className="flex items-start gap-2">
                <div
                  className="w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center"
                  style={{
                    background: selected ? 'var(--accent)' : 'transparent',
                    border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {selected && <Check size={10} color="#fff" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {s.project || 'Unknown project'}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                      {s.total_tool_calls} tools
                    </span>
                  </div>
                  {s.task_text && (
                    <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                      {s.task_text}
                    </div>
                  )}
                  {topTools.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {topTools.map(([tool, count]) => (
                        <span
                          key={tool}
                          className="text-xs px-1.5 py-0.5 rounded font-mono"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                        >
                          {tool}:{count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-xs px-3 py-1.5 rounded disabled:opacity-40"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            Previous
          </button>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-xs px-3 py-1.5 rounded disabled:opacity-40"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Pattern summary ─────────────────────────────────────────────────

function PatternSummaryStep({ sessions }: { sessions: CodexCliSessionSummary[] }) {
  const toolTotals = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const s of sessions) {
      for (const [tool, count] of Object.entries(s.tool_calls)) {
        acc[tool] = (acc[tool] ?? 0) + count;
      }
    }
    return Object.entries(acc).sort(([, a], [, b]) => b - a).slice(0, 10);
  }, [sessions]);

  const projects = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) {
      if (s.project) counts[s.project] = (counts[s.project] ?? 0) + 1;
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [sessions]);

  const taskSamples = sessions.filter((s) => s.task_text).slice(0, 5).map((s) => s.task_text);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Here's what we found across your {sessions.length} selected session{sessions.length !== 1 ? 's' : ''}. Use this to inform your agent's system prompt.
      </p>

      {toolTotals.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Top Tools Used
          </h3>
          <div className="flex flex-col gap-1.5">
            {toolTotals.map(([tool, count]) => {
              const max = toolTotals[0][1];
              return (
                <div key={tool} className="flex items-center gap-2">
                  <span className="text-xs font-mono w-32 truncate flex-shrink-0" style={{ color: 'var(--text-primary)' }}>{tool}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(count / max) * 100}%`, background: 'var(--accent)' }}
                    />
                  </div>
                  <span className="text-xs w-8 text-right" style={{ color: 'var(--text-tertiary)' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Projects
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {projects.map(([proj, count]) => (
              <span
                key={proj}
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                {proj} ({count})
              </span>
            ))}
          </div>
        </div>
      )}

      {taskSamples.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Sample Tasks
          </h3>
          <ul className="flex flex-col gap-1.5">
            {taskSamples.map((t, i) => (
              <li key={i} className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                · {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Agent configuration ─────────────────────────────────────────────

const CAPABILITY_OPTIONS: { cap: AgentCapability; label: string; icon: React.ElementType; desc: string }[] = [
  { cap: 'web_search', label: 'Web Search / Scraping', icon: Globe,    desc: 'WebSearch + WebFetch tools' },
  { cap: 'code_exec',  label: 'Code Execution',        icon: Cpu,      desc: 'Bash tool for running scripts' },
  { cap: 'cli',        label: 'CLI Tools',             icon: Terminal, desc: 'Specific CLI tooling guidance' },
  { cap: 'memory',     label: 'Cross-Session Memory',  icon: Database, desc: 'Shared memory file per session' },
];

function ConfigStep({
  form,
  onChange,
}: {
  form: AgentFormState;
  onChange: (patch: Partial<AgentFormState>) => void;
}) {
  const slugFromName = (name: string) =>
    name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').trim().replace(/^-|-$/g, '') || 'agent';

  const handleName = (name: string) => {
    onChange({ name, slug: slugFromName(name) });
  };

  const toggleCap = (cap: AgentCapability) => {
    const caps = form.capabilities.includes(cap)
      ? form.capabilities.filter((c) => c !== cap)
      : [...form.capabilities, cap];
    onChange({ capabilities: caps });
  };

  const toggleTarget = (target: InstallTarget) => {
    const targets = form.install_targets.includes(target)
      ? form.install_targets.filter((t) => t !== target)
      : [...form.install_targets, target];
    onChange({ install_targets: targets });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Name *</label>
          <input
            type="text"
            placeholder="e.g. Full Stack Dev"
            value={form.name}
            onChange={(e) => handleName(e.target.value)}
            className="px-3 py-2 text-sm rounded"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Slug (invocation name)</label>
          <input
            type="text"
            placeholder="e.g. full-stack-dev"
            value={form.slug}
            onChange={(e) => onChange({ slug: e.target.value })}
            className="px-3 py-2 text-sm rounded font-mono"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Description</label>
        <input
          type="text"
          placeholder="When to use this agent…"
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="px-3 py-2 text-sm rounded"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          System Prompt
          <span className="ml-1 font-normal" style={{ color: 'var(--text-tertiary)' }}>— use the pattern summary as a reference</span>
        </label>
        <textarea
          placeholder="Describe what this agent does, its role, and how it should behave…"
          value={form.system_prompt}
          onChange={(e) => onChange({ system_prompt: e.target.value })}
          rows={6}
          className="px-3 py-2 text-sm rounded resize-none"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      <div>
        <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>Install Targets</label>
        <div className="flex gap-3">
          {(['skill', 'subagent'] as InstallTarget[]).map((target) => {
            const active = form.install_targets.includes(target);
            return (
              <button
                key={target}
                onClick={() => toggleTarget(target)}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors"
                style={{
                  background: active ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                  border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: active ? 'var(--accent)' : 'transparent', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}` }}
                >
                  {active && <Check size={10} color="#fff" />}
                </div>
                {target === 'skill' ? '~/.claude/skills/' : '~/.claude/agents/'}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>Capabilities</label>
        <div className="grid grid-cols-2 gap-2">
          {CAPABILITY_OPTIONS.map(({ cap, label, icon: Icon, desc }) => {
            const active = form.capabilities.includes(cap);
            return (
              <button
                key={cap}
                onClick={() => toggleCap(cap)}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded text-left transition-colors"
                style={{
                  background: active ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                  border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
                }}
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: active ? 'var(--accent)' : 'transparent', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}` }}
                >
                  {active && <Check size={10} color="#fff" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Icon size={12} style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)' }} />
                    <span className="text-xs font-medium" style={{ color: active ? 'var(--accent)' : 'var(--text-primary)' }}>{label}</span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{desc}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {form.capabilities.includes('cli') && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>CLI Tools (comma-separated)</label>
          <input
            type="text"
            placeholder="e.g. git, docker, kubectl, npm"
            value={form.cli_tools_raw}
            onChange={(e) => onChange({ cli_tools_raw: e.target.value })}
            className="px-3 py-2 text-sm rounded font-mono"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>
      )}

      {form.capabilities.includes('memory') && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Memory file: <code style={{ color: 'var(--accent)' }}>~/.claude/agent_memory/{form.slug || '<slug>'}.md</code>
        </p>
      )}
    </div>
  );
}

// ─── Step 4: Preview ──────────────────────────────────────────────────────────

function PreviewStep({ agentId }: { agentId: string }) {
  const [tab, setTab] = useState<'skill' | 'subagent'>('skill');
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.agentPreview(agentId),
    queryFn: () => previewAgent(agentId),
  });

  if (isLoading) return <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Generating preview…</p>;

  const content = tab === 'skill' ? data?.skill_md : data?.subagent_md;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Review the generated files. Click Install to write them to disk.
      </p>
      <div className="flex gap-1">
        {(['skill', 'subagent'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="text-xs px-3 py-1.5 rounded"
            style={{
              background: tab === t ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: tab === t ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${tab === t ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            {t === 'skill' ? '~/.claude/skills/' : '~/.claude/agents/'}
          </button>
        ))}
      </div>
      <pre
        className="text-xs p-4 rounded overflow-auto"
        style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          maxHeight: 380,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: '"Chivo Mono", monospace',
        }}
      >
        {content}
      </pre>
    </div>
  );
}

// ─── Main wizard ─────────────────────────────────────────────────────────────

interface AgentFormState {
  name: string;
  slug: string;
  description: string;
  system_prompt: string;
  capabilities: AgentCapability[];
  cli_tools_raw: string;
  install_targets: InstallTarget[];
}

const DEFAULT_FORM: AgentFormState = {
  name: '',
  slug: '',
  description: '',
  system_prompt: '',
  capabilities: [],
  cli_tools_raw: '',
  install_targets: ['skill', 'subagent'],
};

function formToPayload(form: AgentFormState, sessionIds: string[]) {
  return {
    name: form.name,
    slug: form.slug,
    description: form.description,
    system_prompt: form.system_prompt,
    capabilities: form.capabilities,
    cli_tools: form.cli_tools_raw.split(',').map((t) => t.trim()).filter(Boolean),
    install_targets: form.install_targets,
    source_session_ids: sessionIds,
  };
}

export function AgentBuilderPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();

  const isEdit = Boolean(editId);
  const [step, setStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const param = searchParams.get('sessions');
    return param ? new Set(param.split(',').filter(Boolean)) : new Set();
  });
  const [selectedSessions, setSelectedSessions] = useState<CodexCliSessionSummary[]>([]);
  const [form, setForm] = useState<AgentFormState>(DEFAULT_FORM);
  const [savedAgentId, setSavedAgentId] = useState<string | null>(editId ?? null);

  // Load existing agent for edit mode
  const { data: existingAgent } = useQuery({
    queryKey: queryKeys.agent(editId),
    queryFn: () => fetchAgent(editId!),
    enabled: isEdit && Boolean(editId),
  });

  useEffect(() => {
    if (existingAgent) {
      setForm({
        name: existingAgent.name,
        slug: existingAgent.slug,
        description: existingAgent.description,
        system_prompt: existingAgent.system_prompt,
        capabilities: existingAgent.capabilities,
        cli_tools_raw: existingAgent.cli_tools.join(', '),
        install_targets: existingAgent.install_targets,
      });
      setSelectedIds(new Set(existingAgent.source_session_ids));
      if (isEdit) setStep(3);
    }
  }, [existingAgent, isEdit]);

  // Keep selectedSessions in sync — fetch them from the sessions query cache
  const { data: sessionsData } = useQuery({
    queryKey: queryKeys.codexCliSessions(1, ''),
    queryFn: () => fetchCodexCliSessions({ page: 1, limit: 100, sort: 'newest' }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (sessionsData?.items) {
      setSelectedSessions(sessionsData.items.filter((s) => selectedIds.has(s.session_id)));
    }
  }, [sessionsData, selectedIds]);

  const toggleSession = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = formToPayload(form, Array.from(selectedIds));
      if (savedAgentId && !isEdit) {
        return updateAgent(savedAgentId, payload);
      }
      if (isEdit && editId) {
        return updateAgent(editId, payload);
      }
      return createAgent(payload);
    },
    onSuccess: (agent: AgentDefinition) => {
      setSavedAgentId(agent.id);
      qc.invalidateQueries({ queryKey: queryKeys.agentLibrary() });
      qc.invalidateQueries({ queryKey: queryKeys.agentPreview(agent.id) });
    },
  });

  const installMut = useMutation({
    mutationFn: async () => {
      if (!savedAgentId) throw new Error('No agent saved');
      return installAgent(savedAgentId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agentLibrary() });
      navigate('/agent-library');
    },
  });

  const canAdvance = () => {
    if (step === 1) return selectedIds.size > 0;
    if (step === 3) return form.name.trim().length > 0;
    return true;
  };

  const handleNext = async () => {
    if (step === 3) {
      await saveMut.mutateAsync();
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => s - 1);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => navigate('/agent-library')}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <ArrowLeft size={16} />
        </button>
        <Bot size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {isEdit ? 'Edit Agent' : 'Create Agent'}
        </h1>
      </div>

      {/* Step indicator */}
      <div
        className="px-6 py-3 flex items-center gap-4"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
      >
        {[1, 2, 3, 4].map((s, i) => (
          <div key={s} className="flex items-center gap-4">
            <StepIndicator step={s} current={step} />
            {i < 3 && <ChevronRight size={12} style={{ color: 'var(--text-tertiary)' }} />}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {step === 1 && (
            <SessionPickerStep selectedIds={selectedIds} onToggle={toggleSession} />
          )}
          {step === 2 && (
            <PatternSummaryStep sessions={selectedSessions} />
          )}
          {step === 3 && (
            <ConfigStep form={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
          )}
          {step === 4 && savedAgentId && (
            <PreviewStep agentId={savedAgentId} />
          )}
        </div>
      </div>

      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
      >
        <button
          onClick={handleBack}
          disabled={step === 1}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded disabled:opacity-40 transition-colors"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={14} />
          Back
        </button>

        {step < 4 ? (
          <button
            onClick={handleNext}
            disabled={!canAdvance() || saveMut.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded disabled:opacity-40 transition-colors"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {saveMut.isPending ? 'Saving…' : 'Next'}
            <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={() => installMut.mutate()}
            disabled={installMut.isPending || !savedAgentId}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded disabled:opacity-40 transition-colors"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Download size={14} />
            {installMut.isPending ? 'Installing…' : 'Install'}
          </button>
        )}
      </div>
    </div>
  );
}
