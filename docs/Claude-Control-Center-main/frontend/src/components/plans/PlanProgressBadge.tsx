import { cn } from '../../lib/utils';

interface Props {
  completed: number;
  total: number;
  className?: string;
}

export function PlanProgressBadge({ completed, total, className }: Props) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  const done = total > 0 && completed >= total;

  return (
    <span
      className={cn('chip text-xs font-medium', className)}
      style={{
        background: done ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.1)',
        color: done ? '#4ade80' : '#fbbf24',
        border: `1px solid ${done ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.2)'}`,
      }}
    >
      {completed}/{total} steps{pct > 0 && pct < 100 ? ` · ${Math.round(pct)}%` : ''}
    </span>
  );
}
