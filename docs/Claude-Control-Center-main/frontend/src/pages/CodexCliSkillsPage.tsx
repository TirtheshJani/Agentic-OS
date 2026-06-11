import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { Puzzle, Bot, Code, Package, X } from 'lucide-react';
import { fetchCodexCliSkills, fetchCodexCliSystemSkills, fetchCodexCliSkill } from '../api/codexCliSkills';
import type { CodexCliSkill } from '../api/codexCliSkills';
import { cn } from '../lib/utils';

function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="chip text-xs"
      style={{ background: 'rgba(255,255,255,0.05)', color: color || 'var(--text-tertiary)' }}
    >
      {label}
    </span>
  );
}

function SkillCard({ skill, onClick }: { skill: CodexCliSkill; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card text-left px-4 py-3 flex flex-col gap-2 hover:bg-white/[0.04] transition-colors w-full"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {skill.agent_display_name || skill.name || skill.id}
        </span>
        <div className="flex gap-1.5 flex-shrink-0">
          {skill.has_agent && <Badge label="Agent" color="var(--accent)" />}
          {skill.has_scripts && <Badge label="Scripts" />}
          {skill.has_assets && <Badge label="Assets" />}
        </div>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {skill.agent_short_description || skill.short_description || skill.description || '—'}
      </p>
    </button>
  );
}

function SkillDrawer({ skillId, onClose }: { skillId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.codexCliSkill(skillId),
    queryFn: () => fetchCodexCliSkill(skillId),
    staleTime: 60_000,
  });

  return (
    <div
      className="fixed inset-y-0 right-0 w-96 flex flex-col z-50"
      style={{ background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Puzzle size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {data?.agent_display_name || data?.name || skillId}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 transition-all"
        >
          <X size={14} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-5 rounded" />)}
          </div>
        )}

        {data && (
          <>
            {/* Meta badges */}
            <div className="flex flex-wrap gap-1.5">
              {data.has_agent && <Badge label="Has Agent" color="var(--accent)" />}
              {data.has_scripts && (
                <span className="chip text-xs flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}>
                  <Code size={10} /> Scripts
                </span>
              )}
              {data.has_assets && (
                <span className="chip text-xs flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}>
                  <Package size={10} /> Assets
                </span>
              )}
            </div>

            {/* Description */}
            {data.description && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  Description
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{data.description}</p>
              </div>
            )}

            {/* Agent info */}
            {data.has_agent && (data.agent_display_name || data.agent_short_description) && (
              <div className="rounded-md p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Bot size={12} style={{ color: 'var(--accent)' }} />
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Agent
                  </span>
                </div>
                {data.agent_display_name && (
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{data.agent_display_name}</p>
                )}
                {data.agent_short_description && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{data.agent_short_description}</p>
                )}
              </div>
            )}

            {/* SKILL.md body */}
            {data.body && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  SKILL.md
                </div>
                <pre
                  className="text-xs font-mono whitespace-pre-wrap break-words rounded-md p-3 overflow-auto"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    maxHeight: 400,
                  }}
                >
                  {data.body}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type TabKey = 'installed' | 'system';

export function CodexCliSkillsPage() {
  const [tab, setTab] = useState<TabKey>('installed');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const { data: userSkills, isLoading: loadingUser } = useQuery({
    queryKey: queryKeys.codexCliSkills(),
    queryFn: fetchCodexCliSkills,
    staleTime: 60_000,
  });

  const { data: systemSkills, isLoading: loadingSystem } = useQuery({
    queryKey: queryKeys.codexCliSystemSkills(),
    queryFn: fetchCodexCliSystemSkills,
    staleTime: 60_000,
  });

  const skills = tab === 'installed' ? (userSkills ?? []) : (systemSkills ?? []);
  const loading = tab === 'installed' ? loadingUser : loadingSystem;

  return (
    <div className="p-6 flex flex-col h-full gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Puzzle size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Codex Skills</h1>
        <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
          {skills.length} skill{skills.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-0.5 rounded-md w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
        {(['installed', 'system'] as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1.5 text-xs rounded transition-all capitalize',
              tab === t
                ? 'font-medium'
                : 'hover:bg-white/10',
            )}
            style={{
              background: tab === t ? 'rgba(255,255,255,0.08)' : undefined,
              color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {t === 'installed' ? 'Installed' : 'System'}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card px-4 py-3 flex flex-col gap-2">
              <div className="skeleton h-4 w-2/3 rounded" />
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-4/5 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && skills.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <Puzzle size={32} style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {tab === 'installed' ? 'No installed skills found.' : 'No system skills found.'}
          </p>
        </div>
      )}

      {!loading && skills.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3 overflow-auto flex-1 content-start">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onClick={() => setSelectedSkill(skill.id)}
            />
          ))}
        </div>
      )}

      {/* Drawer */}
      {selectedSkill && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setSelectedSkill(null)}
          />
          <SkillDrawer skillId={selectedSkill} onClose={() => setSelectedSkill(null)} />
        </>
      )}
    </div>
  );
}
