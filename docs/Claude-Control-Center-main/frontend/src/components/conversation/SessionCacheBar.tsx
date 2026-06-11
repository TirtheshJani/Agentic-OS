import { ShieldCheck } from 'lucide-react';
import { useSessionCacheStats } from '../../hooks/useCache';
import { formatTokens } from '../../lib/utils';

function hitRateColor(rate: number): string {
  if (rate >= 60) return '#3ec85e';
  if (rate >= 30) return '#d29522';
  return '#f87171';
}

interface Props {
  projectDir: string;
  sessionId: string;
}

export function SessionCacheBar({ projectDir, sessionId }: Props) {
  const { data, isError } = useSessionCacheStats(projectDir, sessionId);

  if (isError || !data) return null;
  if (data.hit_rate === 0 && data.savings_usd === 0 && data.cache_read_tokens === 0) return null;

  const color = hitRateColor(data.hit_rate);
  const savingsCAD = (data.savings_usd * 1.38).toFixed(3);

  return (
    <div
      className="flex items-center gap-4 px-4 py-1.5 text-xs"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)' }}
    >
      <ShieldCheck size={12} color="#0ecbbe" />
      <span style={{ color: 'var(--text-secondary)' }}>
        Cache hit rate:{' '}
        <span style={{ color, fontWeight: 600 }}>{data.hit_rate.toFixed(1)}%</span>
      </span>
      <span style={{ color: 'var(--text-tertiary)' }}>
        {formatTokens(data.cache_read_tokens)} cached reads
      </span>
      <span style={{ color: 'var(--text-tertiary)' }}>
        Saved ~${savingsCAD} CAD
      </span>
    </div>
  );
}
