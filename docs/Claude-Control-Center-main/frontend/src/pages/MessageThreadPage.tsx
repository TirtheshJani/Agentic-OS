import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MessageThread } from '../components/conversation/MessageThread';
import { SessionGoalPanel } from '../components/goals/SessionGoalPanel';
import { SessionCacheBar } from '../components/conversation/SessionCacheBar';

export function MessageThreadPage() {
  const { projectId, sessionId } = useParams<{ projectId: string; sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetMessageId = searchParams.get('msg');

  if (!projectId || !sessionId) return null;

  const decodedProject = decodeURIComponent(projectId);
  const decodedSession = decodeURIComponent(sessionId);

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)' }}
      >
        <button
          onClick={() => navigate(`/conversations/${encodeURIComponent(decodedProject)}`)}
          className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={12} />
          Sessions
        </button>
        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
        <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>
          {decodedSession.slice(0, 8)}…
        </span>
      </div>

      <SessionGoalPanel projectId={decodedProject} sessionId={decodedSession} />
      <SessionCacheBar projectDir={decodedProject} sessionId={decodedSession} />

      <div className="flex-1 min-h-0">
        <MessageThread
          projectId={decodedProject}
          sessionId={decodedSession}
          targetMessageId={targetMessageId}
        />
      </div>
    </div>
  );
}
