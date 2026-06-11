import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { relativeTime } from '../../lib/utils';
import type { GwsAuditRecord, GwsActivityRecord } from '../../api/gws';

const SOURCE_COLORS: Record<string, string> = {
  manual: 'var(--accent)',
  hook: '#fb923c',
  codex: '#4ade80',
  'claude-code': '#818cf8',
  recipe: '#c084fc',
  snapshot: 'var(--text-tertiary)',
};

export function AuditRow({ record }: { record: GwsAuditRecord }) {
  const color = SOURCE_COLORS[record.source] ?? 'var(--text-tertiary)';
  return (
    <div className="flex items-center gap-3 py-1.5 px-3 rounded text-xs" style={{ background: 'var(--bg-secondary)' }}>
      <span
        className="px-1.5 py-0.5 rounded-sm uppercase tracking-wide flex-shrink-0"
        style={{ background: `${color}22`, color, fontSize: 9, fontWeight: 700 }}
      >
        {record.source}
      </span>
      <span className="flex-shrink-0 font-mono" style={{ color: 'var(--accent)', fontSize: 10 }}>{record.service}</span>
      <span className="truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{record.full_args.join(' ')}</span>
      {record.returncode === 0
        ? <CheckCircle size={11} style={{ color: 'var(--success)', flexShrink: 0 }} />
        : <XCircle size={11} style={{ color: '#f85149', flexShrink: 0 }} />}
      <span className="flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{record.duration_ms}ms</span>
      <span className="flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{relativeTime(record.ts)}</span>
    </div>
  );
}

const ACTIVITY_SOURCE_COLORS: Record<string, string> = {
  manual: 'var(--accent)',
  hook: '#fb923c',
  codex: '#4ade80',
  'claude-code': '#818cf8',
  recipe: '#c084fc',
};

export function ActivityRow({ record }: { record: GwsActivityRecord }) {
  const color = ACTIVITY_SOURCE_COLORS[record.source] ?? 'var(--text-tertiary)';
  return (
    <div className="flex items-center gap-3 py-1.5 px-3 rounded text-xs" style={{ background: 'var(--bg-secondary)' }}>
      <span
        className="px-1.5 py-0.5 rounded-sm uppercase tracking-wide flex-shrink-0"
        style={{ background: `${color}22`, color, fontSize: 9, fontWeight: 700, minWidth: 68, textAlign: 'center' }}
      >
        {record.source}
      </span>
      <span className="flex-shrink-0 font-mono" style={{ color: 'var(--accent)', fontSize: 10, minWidth: 52 }}>
        {record.service || '—'}
      </span>
      <span className="truncate flex-1" style={{ color: 'var(--text-secondary)' }}>
        {record.command_summary || record.full_args.join(' ') || '—'}
      </span>
      {record.project && (
        <span className="text-xs truncate max-w-28 flex-shrink-0" style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>
          {record.project.split('/').slice(-1)[0]}
        </span>
      )}
      {record.status === 'ok'
        ? <CheckCircle size={11} style={{ color: 'var(--success)', flexShrink: 0 }} />
        : record.status === 'error'
          ? <XCircle size={11} style={{ color: '#f85149', flexShrink: 0 }} />
          : <Clock size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />}
      {record.duration_ms != null && (
        <span className="flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{record.duration_ms}ms</span>
      )}
      {record.started_at && (
        <span className="flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{relativeTime(record.started_at)}</span>
      )}
    </div>
  );
}
