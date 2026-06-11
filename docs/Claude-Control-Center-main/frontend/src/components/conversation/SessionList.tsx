import { useNavigate } from 'react-router-dom';
import { GitBranch, MessageSquare, Clock, Bot, ChevronRight } from 'lucide-react';
import { useSessions } from '../../hooks/useProjects';
import { relativeTime, sessionLabel, shortPath } from '../../lib/utils';

interface Props {
  projectId: string;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="skeleton h-4 w-32" />
      <div className="skeleton h-4 w-48" />
      <div className="skeleton h-4 w-20" />
      <div className="skeleton h-4 w-16 ml-auto" />
    </div>
  );
}

export function SessionList({ projectId }: Props) {
  const { data: sessions, isLoading, error } = useSessions(projectId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="card overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm" style={{ color: 'var(--error)' }}>Failed to load sessions</p>
      </div>
    );
  }

  if (!sessions?.length) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No sessions found</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden animate-fade-in">
      {/* Header row */}
      <div className="grid grid-cols-[2fr_3fr_1fr_1fr_auto] gap-4 px-4 py-2 text-xs font-medium uppercase tracking-wider"
        style={{ color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
        <span>Session</span>
        <span>Directory</span>
        <span>Branch</span>
        <span>Messages</span>
        <span>Last active</span>
      </div>

      {sessions.map((session) => (
        <button
          key={session.sessionId}
          onClick={() => navigate(`/conversations/${encodeURIComponent(projectId)}/${encodeURIComponent(session.sessionId)}`)}
          className="w-full grid grid-cols-[2fr_3fr_1fr_1fr_auto] gap-4 px-4 py-3 text-left transition-colors duration-100 hover:bg-white/[0.03] group"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-mono truncate" style={{ color: 'var(--accent)' }}>
              {sessionLabel(session)}
            </span>
            {session.hasSubagents && (
              <Bot size={12} style={{ color: '#a855f7', flexShrink: 0 }} aria-label="Has subagents" />
            )}
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
              {shortPath(session.cwd)}
            </span>
          </div>

          <div className="flex items-center">
            {session.gitBranch ? (
              <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                <GitBranch size={10} />
                {session.gitBranch}
              </span>
            ) : (
              <span style={{ color: 'var(--text-tertiary)' }}>—</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <MessageSquare size={11} style={{ color: 'var(--text-tertiary)' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {session.messageCount}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {relativeTime(session.lastMessageAt)}
            </span>
            <ChevronRight size={12} style={{ color: 'var(--text-tertiary)', opacity: 0 }}
              className="group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      ))}
    </div>
  );
}
