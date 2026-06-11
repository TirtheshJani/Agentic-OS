import { useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useGwsStream } from '../../hooks/useGwsStream';

export function StreamDrawer({ args, source, onClose }: { args: string[]; source?: string; onClose: () => void }) {
  const { lines, running, error, start } = useGwsStream();

  useEffect(() => {
    start(args, source ?? 'manual');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-t-lg overflow-hidden"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', maxHeight: '60vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            {running ? 'Running…' : 'Output'}
          </span>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }}><X size={14} /></button>
        </div>
        <div className="overflow-y-auto p-4 font-mono text-xs" style={{ maxHeight: 'calc(60vh - 40px)', color: 'var(--text-primary)', background: 'var(--bg-code)' }}>
          {lines.length === 0 && running && (
            <div className="flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
              <Loader2 size={12} className="animate-spin" /> Starting…
            </div>
          )}
          {lines.map((line, i) => <div key={i}>{line.text || ' '}</div>)}
          {error && <div style={{ color: '#f87171' }}>{error}</div>}
          {!running && !error && lines.length > 0 && <div style={{ color: 'var(--success)' }}>✓ Done</div>}
        </div>
      </div>
    </div>
  );
}
