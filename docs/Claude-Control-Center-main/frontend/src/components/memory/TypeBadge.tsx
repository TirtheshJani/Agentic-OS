import { cn } from '../../lib/utils';

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  user:      { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa', label: 'User' },
  feedback:  { bg: 'rgba(234,179,8,0.12)',   text: '#facc15', label: 'Feedback' },
  project:   { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', label: 'Project' },
  reference: { bg: 'rgba(168,85,247,0.12)',  text: '#c084fc', label: 'Reference' },
};

interface Props {
  type: string;
  className?: string;
}

export function TypeBadge({ type, className }: Props) {
  const style = TYPE_STYLES[type] ?? { bg: 'rgba(255,255,255,0.06)', text: '#8b949e', label: type || '—' };
  return (
    <span
      className={cn('chip', className)}
      style={{ background: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}
