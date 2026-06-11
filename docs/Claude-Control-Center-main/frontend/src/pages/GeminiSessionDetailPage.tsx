import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { Sparkles, ArrowLeft, GitBranch, Clock, Wrench, User, Bot, Zap, Radio } from 'lucide-react';
import { fetchGeminiSession } from '../api/gemini';
import type { GeminiSessionEvent } from '../api/gemini';
import { absoluteTime } from '../lib/utils';
import { useGeminiSSE } from '../hooks/useGeminiSSE';

function EventBubble({ event }: { event: GeminiSessionEvent }) {
  const payload = event.payload as Record<string, unknown>;
  const msgType = payload.type as string | undefined;
  const role = payload.role as string | undefined;

  if (event.type === 'event_msg') {
    const message = (payload.message as string) || '';
    if (msgType === 'user_message') {
      return (
        <div className="flex gap-3 px-5 py-3">
          <div className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)' }}>
            <User size={12} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="flex-1 text-xs leading-relaxed rounded-md px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            {message}
          </div>
        </div>
      );
    }
    if (msgType === 'agent_message') {
      return (
        <div className="flex gap-3 px-5 py-3">
          <div className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
            <Bot size={12} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div className="flex-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{message}</div>
        </div>
      );
    }
    if (msgType === 'task_started') {
      return (
        <div className="px-5 py-2">
          <span className="chip text-xs" style={{ background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success-border)' }}>
            <Zap size={10} style={{ display: 'inline', marginRight: 4 }} />
            Task started
          </span>
        </div>
      );
    }
  }

  if (event.type === 'response_item' && msgType === 'function_call') {
    const name = (payload.name as string) || 'tool';
    const args = (payload.arguments as string) || '';
    return (
      <div className="px-5 py-1.5">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          <Wrench size={11} style={{ color: 'var(--text-tertiary)' }} />
          <span>{name}</span>
          {args && <span className="truncate max-w-xs opacity-60" title={args}>{args}</span>}
        </div>
      </div>
    );
  }

  if (event.type === 'response_item' && role === 'user') {
    const content = payload.content as string | { type: string; text?: string }[] | null;
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((c) => (typeof c === 'object' && c.text) ? c.text : '').join('')
        : '';
    if (!text) return null;
    return (
      <div className="flex gap-3 px-5 py-3">
        <div className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)' }}>
          <User size={12} style={{ color: 'var(--accent)' }} />
        </div>
        <div className="flex-1 text-xs leading-relaxed rounded-md px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          {text}
        </div>
      </div>
    );
  }

  return null;
}

export function GeminiSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  useGeminiSSE(sessionId);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.geminiSession(sessionId),
    queryFn: () => fetchGeminiSession(sessionId!),
    enabled: !!sessionId,
    staleTime: 10_000,
  });

  const summary = data?.summary;
  const events = data?.events ?? [];
  const isLive = summary?.last_ts
    ? (Date.now() - new Date(summary.last_ts).getTime()) < 2 * 60 * 1000
    : false;
  const durationStr = summary?.duration_seconds != null
    ? summary.duration_seconds < 60
      ? `${Math.round(summary.duration_seconds)}s`
      : `${Math.round(summary.duration_seconds / 60)}m`
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => navigate('/gemini-sessions')} className="p-1.5 rounded hover:bg-white/10 transition-all">
          <ArrowLeft size={14} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <Sparkles size={15} style={{ color: 'var(--accent)' }} />
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {summary?.project || 'Session Detail'}
        </h1>
        {summary?.model && (
          <span className="chip text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>{summary.model}</span>
        )}
        {isLive && (
          <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success-border)' }}>
            <Radio size={10} />Live
          </span>
        )}
      </div>

      {summary && (
        <div className="flex items-center gap-6 px-5 py-2 flex-shrink-0 text-xs" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
          {summary.first_ts && <div className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}><Clock size={11} />{absoluteTime(summary.first_ts)}</div>}
          {durationStr && <span style={{ color: 'var(--text-tertiary)' }}>Duration: {durationStr}</span>}
          {summary.git_branch && <div className="flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}><GitBranch size={11} />{summary.git_branch}</div>}
          <div className="flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}><Wrench size={11} />{summary.total_tool_calls} tool calls</div>
          {summary.cwd && <span className="font-mono truncate" style={{ color: 'var(--text-tertiary)', maxWidth: 300 }}>{summary.cwd}</span>}
        </div>
      )}

      <div className="flex-1 overflow-auto py-2">
        {isLoading && (
          <div className="flex flex-col gap-3 px-5 py-4">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10 rounded-md" />)}
          </div>
        )}
        {error && <div className="flex items-center justify-center h-full"><p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Failed to load session.</p></div>}
        {!isLoading && !error && events.length === 0 && <div className="flex items-center justify-center h-full"><p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No events to display.</p></div>}
        {!isLoading && events.map((event, i) => <EventBubble key={i} event={event} />)}
      </div>
    </div>
  );
}
