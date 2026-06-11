import { Folder, GitBranch, Clock, Tag } from 'lucide-react';
import { absoluteTime, shortPath } from '../../lib/utils';

interface Props {
  cwd?: string | null;
  gitBranch?: string | null;
  version?: string | null;
  sessionStart?: string | null;
  slug?: string | null;
}

export function SessionMeta({ cwd, gitBranch, version, sessionStart, slug }: Props) {
  return (
    <div
      className="flex items-center gap-4 px-4 py-2.5 flex-wrap"
      style={{
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {cwd && (
        <div className="flex items-center gap-1.5 min-w-0">
          <Folder size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <span className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}
            title={cwd}>
            {shortPath(cwd)}
          </span>
        </div>
      )}
      {gitBranch && (
        <div className="flex items-center gap-1.5">
          <GitBranch size={12} style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
            {gitBranch}
          </span>
        </div>
      )}
      {sessionStart && (
        <div className="flex items-center gap-1.5">
          <Clock size={12} style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {absoluteTime(sessionStart)}
          </span>
        </div>
      )}
      {slug && (
        <div className="flex items-center gap-1.5">
          <Tag size={12} style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{slug}</span>
        </div>
      )}
      {version && (
        <span className="chip ml-auto" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}>
          v{version}
        </span>
      )}
    </div>
  );
}
