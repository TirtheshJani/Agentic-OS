import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { HeartPulse, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { fetchHealthReferences } from '../api/health';
import type { HealthIssue } from '../types';

const TYPE_LABELS: Record<string, string> = {
  skill: 'Skill',
  command: 'Command',
  agent_library: 'Agent Library',
  hook: 'Hook',
};

const TYPE_COLORS: Record<string, string> = {
  skill: '#a855f7',
  command: '#fb923c',
  agent_library: '#60a5fa',
  hook: '#facc15',
};

function IssueCard({ issue }: { issue: HealthIssue }) {
  const color = TYPE_COLORS[issue.type] ?? 'var(--text-secondary)';
  return (
    <div
      className="card p-4"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="chip text-xs"
              style={{ background: `${color}20`, color }}
            >
              {TYPE_LABELS[issue.type] ?? issue.type}
            </span>
            <span className="font-mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {issue.resource}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{issue.hint}</p>
          <code className="text-xs mt-1 block" style={{ color: 'var(--text-tertiary)' }}>
            Missing: {issue.brokenRef}
          </code>
        </div>
      </div>
    </div>
  );
}

export function HealthPage() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.healthReferences(),
    queryFn: fetchHealthReferences,
    staleTime: 0,
  });

  const issues = data?.issues ?? [];
  const grouped = issues.reduce<Record<string, HealthIssue[]>>((acc, issue) => {
    (acc[issue.type] ??= []).push(issue);
    return acc;
  }, {});

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <HeartPulse size={18} style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Reference Health</h1>
        </div>
        <button
          className="btn-secondary flex items-center gap-2 text-sm px-3 py-1.5"
          onClick={() => qc.invalidateQueries({ queryKey: queryKeys.healthReferences() })}
          disabled={isFetching}
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          Rescan
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card p-4"><div className="skeleton h-12 w-full" /></div>)}
        </div>
      ) : issues.length === 0 ? (
        <div className="card p-8 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: 'var(--success)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>All references look good</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            No broken references found across skills, commands, hooks, or agents.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div
            className="px-4 py-3 rounded-lg flex items-center gap-3"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <AlertTriangle size={15} style={{ color: '#f87171' }} />
            <span className="text-sm" style={{ color: '#f87171' }}>
              {issues.length} broken reference{issues.length !== 1 ? 's' : ''} found
            </span>
          </div>
          {Object.entries(grouped).map(([type, typeIssues]) => (
            <div key={type}>
              <h2
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {TYPE_LABELS[type] ?? type} ({typeIssues.length})
              </h2>
              <div className="space-y-2">
                {typeIssues.map((issue, idx) => <IssueCard key={idx} issue={issue} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
