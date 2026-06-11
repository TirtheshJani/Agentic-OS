import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Wrench, User, Bot } from 'lucide-react';
import { useAntigravitySession } from '../hooks/useAntigravity';
import { absoluteTime } from '../lib/utils';

function EventBubble({ event }: { event: any }) {
  const payload = event.payload || {};
  const msgType = payload.type;
  
  if (msgType === 'user_message') {
    return (
      <div className="flex gap-3 px-5 py-3">
        <div className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)' }}>
          <User size={12} style={{ color: 'var(--accent)' }} />
        </div>
        <div className="flex-1 text-xs leading-relaxed rounded-md px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          {payload.message}
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
        <div className="flex-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {payload.message}
        </div>
      </div>
    );
  }

  if (msgType === 'function_call') {
    return (
      <div className="px-5 py-1.5">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          <Wrench size={11} style={{ color: 'var(--text-tertiary)' }} />
          <span>{payload.name}</span>
          {payload.arguments && <span className="truncate max-w-xs opacity-60" title={payload.arguments}>{payload.arguments}</span>}
        </div>
      </div>
    );
  }
  return null;
}

export function AntigravitySessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useAntigravitySession(id!);

  if (isLoading) {
    return <div className="p-6 flex justify-center"><div className="skeleton h-8 w-32" /></div>;
  }

  if (!data || !data.summary) {
    return (
      <div className="p-6">
        <button onClick={() => navigate('/antigravity-sessions')} className="flex items-center gap-2 text-xs font-medium hover:opacity-80 transition-all" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={14} /> Back to sessions
        </button>
        <div className="mt-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>Session not found.</div>
      </div>
    );
  }

  const { summary, events } = data;

  return (
    <div className="p-6 flex flex-col h-full gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/antigravity-sessions')} className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-all" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{summary.task_text || summary.session_id}</h1>
      </div>

      <div className="card px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-tertiary)' }}>Started</span>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{summary.first_ts ? absoluteTime(summary.first_ts) : '—'}</span>
        </div>
        <div>
          <span className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-tertiary)' }}>Project</span>
          <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{summary.project || '—'}</span>
        </div>
        <div>
          <span className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-tertiary)' }}>Duration</span>
          <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <Clock size={14} /> {summary.duration_seconds != null ? `${Math.round(summary.duration_seconds)}s` : '—'}
          </span>
        </div>
        <div>
          <span className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--text-tertiary)' }}>Tools used</span>
          <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <Wrench size={14} /> {summary.total_tool_calls}
          </span>
        </div>
      </div>

      <div className="card flex-1 flex flex-col overflow-hidden min-h-0 bg-[#0A0A0A] overflow-y-auto py-2">
        {events && events.length > 0 ? (
          events.map((e: any, i: number) => <EventBubble key={i} event={e} />)
        ) : (
          <div className="p-6 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>No conversation events found for this session.</div>
        )}
      </div>
    </div>
  );
}
