import { Radio } from 'lucide-react';
import { useActiveSessions } from '../../hooks/useSettings';

export function ActiveSessionBadge() {
  const { data } = useActiveSessions();
  const alive = data?.filter((s) => s.isAlive) ?? [];
  const aliveCount = alive.length;
  const remoteCount = alive.filter((s) => s.bridgeSessionId).length;

  if (aliveCount === 0) return null;

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium"
      style={{ background: 'var(--success-dim)', color: 'var(--success)', borderRadius: 2 }}>
      <span className="w-1.5 h-1.5 animate-pulse-dot" style={{ background: 'var(--success)', borderRadius: 0, display: 'inline-block' }} />
      {aliveCount}
      {remoteCount > 0 && (
        <span
          className="inline-flex items-center gap-0.5"
          title={`${remoteCount} session${remoteCount !== 1 ? 's' : ''} with remote control active`}
          style={{ color: '#60a5fa', marginLeft: 2 }}
        >
          <Radio size={10} />
          {remoteCount}
        </span>
      )}
    </span>
  );
}
