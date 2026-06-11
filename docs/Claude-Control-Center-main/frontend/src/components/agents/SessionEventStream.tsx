import type { AgentEvent } from '../../types';

interface Props {
  events: AgentEvent[];
  connected: boolean;
}

export function SessionEventStream({ events, connected }: Props) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 py-16">
        <div
          className={connected ? 'animate-pulse' : ''}
          style={{
            width: 8, height: 8, borderRadius: 0,
            background: connected ? 'var(--success)' : 'var(--text-tertiary)',
          }}
        />
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {connected ? 'Waiting for events...' : 'Not connected'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {events.map((ev, i) => {
        const isError = ev.event === 'error';
        const dataStr = typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data, null, 2);
        return (
          <div
            key={i}
            className="rounded-lg text-xs"
            style={{
              background: isError ? 'rgba(248,81,73,0.06)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isError ? 'rgba(248,81,73,0.3)' : 'var(--border)'}`,
            }}
          >
            <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="chip font-mono" style={{
                background: isError ? 'oklch(62% 0.22 25 / 0.12)' : 'oklch(71% 0.185 192 / 0.12)',
                color: isError ? 'var(--error)' : 'var(--accent)',
              }}>
                {ev.event}
              </span>
              {ev.timestamp && (
                <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
            <pre
              className="p-3 font-mono text-xs whitespace-pre-wrap break-all overflow-auto"
              style={{ maxHeight: 200, color: 'var(--text-secondary)', margin: 0 }}
            >
              {dataStr}
            </pre>
          </div>
        );
      })}
    </div>
  );
}
