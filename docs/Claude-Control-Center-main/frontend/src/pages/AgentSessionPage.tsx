import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { ArrowLeft, Radio } from 'lucide-react';
import { fetchSession } from '../api/agents';
import { useAgentSSE, useSessionMutations } from '../hooks/useAgents';
import { SessionEventStream } from '../components/agents/SessionEventStream';
import { MessageInput } from '../components/agents/MessageInput';
import { absoluteTime } from '../lib/utils';

export function AgentSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const { data: session, isLoading } = useQuery({
    queryKey: queryKeys.agentSession(sessionId),
    queryFn: () => fetchSession(sessionId!),
    enabled: !!sessionId,
    staleTime: 10_000,
  });

  const { events, connected } = useAgentSSE(sessionId ?? null);
  const { sendMessage } = useSessionMutations();

  const handleSend = (message: string) => {
    if (sessionId) {
      sendMessage.mutate({ sessionId, message });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => navigate('/agents')}
          className="p-1.5 rounded hover:bg-white/10 transition-all"
        >
          <ArrowLeft size={14} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <Radio size={15} style={{ color: connected ? 'var(--success)' : 'var(--text-tertiary)' }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-mono truncate" style={{ color: 'var(--text-primary)' }}>
            Session {sessionId?.slice(0, 12)}...
          </div>
          {session && (
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {session.status} · Created {absoluteTime(session.created_at)}
            </div>
          )}
        </div>
        {session && (
          <span
            className="chip"
            style={{
              background: session.status === 'running'
                ? 'var(--success-dim)'
                : session.status === 'error'
                  ? 'oklch(62% 0.22 25 / 0.12)'
                  : 'oklch(100% 0 0 / 0.06)',
              color: session.status === 'running'
                ? 'var(--success)'
                : session.status === 'error'
                  ? 'var(--error)'
                  : 'var(--text-secondary)',
            }}
          >
            {session.status}
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Loading session...</span>
        </div>
      )}

      {/* Event stream */}
      {!isLoading && (
        <div className="flex-1 overflow-auto">
          <SessionEventStream events={events} connected={connected} />
        </div>
      )}

      {/* Message input */}
      <MessageInput
        onSend={handleSend}
        disabled={sendMessage.isPending || session?.status === 'stopped'}
      />
    </div>
  );
}
