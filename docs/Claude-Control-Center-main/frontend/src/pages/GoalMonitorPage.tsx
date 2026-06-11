import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Target, ExternalLink, CheckSquare, Square, Clock } from 'lucide-react';
import { useAllGoals } from '../hooks/useGoals';
import { cn } from '../lib/utils';
import { shortPath, relativeTime } from '../lib/utils';
import type { GoalStatus, SessionGoalSummary } from '../types';

const STATUS_TABS: { label: string; value: GoalStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cleared', value: 'cleared' },
];

const STATUS_COLORS: Record<GoalStatus, string> = {
  active:    'var(--green-500)',
  paused:    'var(--orange-500)',
  completed: 'var(--steel-500)',
  cleared:   'var(--ds-neutral-500)',
};

function GoalRow({ summary }: { summary: SessionGoalSummary }) {
  const sessionPath = `/conversations/${encodeURIComponent(summary.projectId)}/${encodeURIComponent(summary.sessionId)}`;

  return (
    <div className="card" style={{ padding: '12px 16px', marginBottom: 8 }}>
      {/* Session header */}
      <div className="flex items-center gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono-ds)',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {summary.cwd ? shortPath(summary.cwd) : summary.sessionId.slice(0, 12) + '…'}
        </span>
        {summary.lastMessageAt && (
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} />
            {relativeTime(summary.lastMessageAt)}
          </span>
        )}
        <Link
          to={sessionPath}
          style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}
          title="Open session"
        >
          <ExternalLink size={12} />
        </Link>
      </div>

      {/* Goals */}
      {summary.goals.map((goal) => {
        const color = STATUS_COLORS[goal.status];
        const total = goal.milestones.length;
        const done = goal.milestones.filter((m) => m.completed).length;

        return (
          <div key={goal.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-start gap-2 mb-2">
              <span
                className="chip"
                style={{
                  background: `color-mix(in oklch, ${color} 15%, transparent)`,
                  color,
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: 2,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {goal.status}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                {goal.text}
              </span>
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div
                  style={{
                    flex: 1,
                    height: 3,
                    background: 'var(--border)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${goal.progress}%`,
                      background: color,
                      borderRadius: 2,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0, fontFamily: 'var(--font-mono-ds)' }}>
                  {done}/{total} milestones
                </span>
              </div>
            )}

            {/* Milestone list (preview, up to 5) */}
            {goal.milestones.length > 0 && (
              <div style={{ paddingLeft: 4 }}>
                {goal.milestones.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex items-center gap-2" style={{ padding: '2px 0' }}>
                    {m.completed
                      ? <CheckSquare size={12} style={{ color: 'var(--green-500)', flexShrink: 0 }} />
                      : <Square size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    }
                    <span style={{
                      fontSize: '11px',
                      color: m.completed ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                      textDecoration: m.completed ? 'line-through' : 'none',
                    }}>
                      {m.text}
                    </span>
                  </div>
                ))}
                {goal.milestones.length > 5 && (
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingLeft: 16 }}>
                    +{goal.milestones.length - 5} more
                  </span>
                )}
              </div>
            )}

            {total === 0 && (
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>
                No milestones — open the session to add some.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function GoalMonitorPage() {
  const { data, isLoading, error } = useAllGoals();
  const [statusFilter, setStatusFilter] = useState<GoalStatus | 'all'>('all');

  const allSessions = data?.sessions ?? [];

  const filtered = statusFilter === 'all'
    ? allSessions
    : allSessions
        .map((s) => ({ ...s, goals: s.goals.filter((g) => g.status === statusFilter) }))
        .filter((s) => s.goals.length > 0);

  const totalGoals = allSessions.reduce((sum, s) => sum + s.goals.length, 0);
  const activeGoals = allSessions.reduce(
    (sum, s) => sum + s.goals.filter((g) => g.status === 'active').length,
    0,
  );
  const completedGoals = allSessions.reduce(
    (sum, s) => sum + s.goals.filter((g) => g.status === 'completed').length,
    0,
  );

  return (
    <div style={{ padding: '24px 28px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Target size={20} style={{ color: 'var(--orange-500)' }} />
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Goal Monitor
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
            Track <code>/goal</code> commands across your Claude Code and Codex sessions
          </p>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total goals', value: totalGoals, color: 'var(--text-primary)' },
            { label: 'Active', value: activeGoals, color: 'var(--green-500)' },
            { label: 'Completed', value: completedGoals, color: 'var(--steel-500)' },
            { label: 'Sessions', value: allSessions.length, color: 'var(--text-secondary)' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="card"
              style={{ padding: '10px 16px', minWidth: 90, textAlign: 'center' }}
            >
              <div style={{ fontSize: '20px', fontWeight: 700, color, fontFamily: 'var(--font-mono-ds)' }}>
                {value}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {STATUS_TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={cn('chip', statusFilter === value && 'active')}
            style={{
              fontSize: '11px',
              padding: '3px 10px',
              borderRadius: 2,
              background: statusFilter === value ? 'var(--orange-500)' : 'transparent',
              color: statusFilter === value ? '#fff' : 'var(--text-secondary)',
              border: statusFilter === value ? 'none' : '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Scanning sessions…</p>
      )}
      {error && (
        <p style={{ color: '#f87171', fontSize: '13px' }}>Failed to load goals.</p>
      )}
      {!isLoading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
          <Target size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: '13px', margin: 0 }}>
            {statusFilter === 'all'
              ? 'No /goal commands detected in any session yet.'
              : `No ${statusFilter} goals found.`}
          </p>
          {statusFilter === 'all' && (
            <p style={{ fontSize: '12px', marginTop: 6, color: 'var(--text-tertiary)' }}>
              Use <code style={{ fontFamily: 'var(--font-mono-ds)' }}>/goal &lt;your objective&gt;</code> in Claude Code or Codex to set a goal.
            </p>
          )}
        </div>
      )}
      {!isLoading && filtered.map((summary) => (
        <GoalRow key={`${summary.projectId}/${summary.sessionId}`} summary={summary} />
      ))}
    </div>
  );
}
