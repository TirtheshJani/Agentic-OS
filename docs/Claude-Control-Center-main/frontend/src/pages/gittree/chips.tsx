import type { CommitAttribution } from '../../types';
import { ATTR_COLORS, ATTR_LABELS, ATTR_BG } from './lanes';

export function AttrChip({ attribution }: { attribution: CommitAttribution }) {
  return (
    <span
      className="chip"
      style={{
        background: ATTR_BG[attribution],
        color: ATTR_COLORS[attribution],
        fontSize: '10px',
        fontWeight: 600,
      }}
    >
      {ATTR_LABELS[attribution]}
    </span>
  );
}

export function RefChip({ label }: { label: string }) {
  const isHead = label.startsWith('HEAD');
  const isRemote = label.startsWith('origin/');
  const isTag = label.startsWith('tag:');
  const bg = isHead
    ? 'rgba(14,207,192,0.12)'
    : isTag
    ? 'rgba(234,179,8,0.12)'
    : isRemote
    ? 'rgba(107,114,128,0.10)'
    : 'rgba(59,130,246,0.12)';
  const color = isHead
    ? '#0ecfc0'
    : isTag
    ? '#eab308'
    : isRemote
    ? '#9ca3af'
    : '#60a5fa';
  const display = isTag ? label.replace('tag: ', '') : label;
  return (
    <span
      className="chip"
      style={{ background: bg, color, fontSize: '10px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
    >
      {display}
    </span>
  );
}
