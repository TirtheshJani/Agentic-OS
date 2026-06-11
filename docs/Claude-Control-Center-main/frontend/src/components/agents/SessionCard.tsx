import { Play, Eye } from 'lucide-react';
import type { AgentSession } from '../../types';
import { absoluteTime } from '../../lib/utils';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  starting: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24' },
  running:  { bg: 'var(--success-dim)',  text: 'var(--success)' },
  stopped:  { bg: 'rgba(139,148,158,0.12)', text: '#8b949e' },
  error:    { bg: 'rgba(248,81,73,0.12)',  text: '#f85149' },
};

interface Props {
  session: AgentSession;
  onView?: (session: AgentSession) => void;
}

export function SessionCard({ session, onView }: Props) {
  const statusStyle = STATUS_COLORS[session.status] ?? STATUS_COLORS.stopped;

  return (
    <div className="card px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
      <Play size={14} style={{ color: statusStyle.text }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono truncate" style={{ color: 'var(--text-primary)' }}>
          {session.id}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
          {session.created_at ? absoluteTime(session.created_at) : '—'}
        </div>
      </div>
      <span className="chip" style={{ background: statusStyle.bg, color: statusStyle.text }}>
        {session.status}
      </span>
      {onView && (
        <button
          onClick={() => onView(session)}
          className="p-1.5 rounded hover:bg-white/10 transition-all"
          title="View session"
        >
          <Eye size={13} style={{ color: 'var(--text-secondary)' }} />
        </button>
      )}
    </div>
  );
}
