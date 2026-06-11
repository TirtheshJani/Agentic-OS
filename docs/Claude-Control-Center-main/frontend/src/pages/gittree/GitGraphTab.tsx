import { useState, useMemo } from 'react';
import { GitBranch, RefreshCw } from 'lucide-react';
import { cn, relativeTime } from '../../lib/utils';
import type { CommitAttribution } from '../../types';
import { useCommitGraph } from '../../hooks/useGitTree';
import { ATTR_COLORS, ATTR_LABELS, ATTR_BG, LANE_W, ROW_H, computeLanes } from './lanes';
import { LaneSvg } from './LaneSvg';
import { AttrChip, RefChip } from './chips';

type AttrFilter = 'all' | CommitAttribution;

export function GitGraphTab({ repoId }: { repoId: string | null }) {
  const [limit, setLimit] = useState(100);
  const [filter, setFilter] = useState<AttrFilter>('all');
  const { data: commits = [], isLoading, refetch } = useCommitGraph(repoId, limit);

  const filtered = useMemo(
    () => (filter === 'all' ? commits : commits.filter((c) => c.attribution === filter)),
    [commits, filter]
  );

  const laneData = useMemo(() => computeLanes(filtered), [filtered]);

  const maxLanes = useMemo(
    () =>
      laneData.reduce((m, d) => {
        const localMax = Math.max(d.myLane + 1, d.lanesBefore.length, d.lanesAfter.length);
        return Math.max(m, localMax);
      }, 1),
    [laneData]
  );

  if (!repoId) {
    return (
      <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
        <GitBranch size={28} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Select a repository to view the commit graph.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1">
          {(['all', 'claude', 'codex', 'user', 'unknown'] as AttrFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn('chip cursor-pointer transition-all', filter === f ? 'opacity-100' : 'opacity-50 hover:opacity-75')}
              style={
                f === 'all'
                  ? { background: filter === 'all' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
                  : { background: ATTR_BG[f as CommitAttribution], color: ATTR_COLORS[f as CommitAttribution] }
              }
            >
              {f === 'all' ? 'All' : ATTR_LABELS[f as CommitAttribution]}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Limit:</span>
          <select
            className="input-field"
            style={{ width: 80, padding: '4px 8px', fontSize: 12 }}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
          <button
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={() => refetch()}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3">
        {(['claude', 'codex', 'user', 'unknown'] as CommitAttribution[]).map((a) => (
          <span key={a} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: ATTR_COLORS[a], display: 'inline-block' }} />
            {ATTR_LABELS[a]}
          </span>
        ))}
      </div>

      {/* Graph */}
      {isLoading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3" style={{ height: ROW_H }}>
              <div className="skeleton" style={{ width: 60, height: 12 }} />
              <div className="skeleton" style={{ flex: 1, height: 12 }} />
            </div>
          ))}
        </div>
      ) : laneData.length === 0 ? (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No commits found.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            {laneData.map((d, rowIdx) => (
              <div
                key={`${d.commit.hash}-${rowIdx}`}
                className="flex items-center gap-3"
                style={{
                  height: ROW_H,
                  borderBottom: '1px solid var(--border)',
                  paddingRight: 12,
                  minWidth: 0,
                }}
              >
                {/* SVG lanes */}
                <div style={{ flexShrink: 0, width: (maxLanes + 1) * LANE_W }}>
                  <LaneSvg data={d} maxLanes={maxLanes} />
                </div>

                {/* Hash */}
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    flexShrink: 0,
                    width: 52,
                  }}
                >
                  {d.commit.shortHash}
                </span>

                {/* Refs */}
                {d.commit.refs.length > 0 && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {d.commit.refs.slice(0, 3).map((ref, i) => (
                      <RefChip key={i} label={ref} />
                    ))}
                  </div>
                )}

                {/* Subject */}
                <span
                  className="text-sm"
                  style={{
                    color: 'var(--text-primary)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {d.commit.subject}
                </span>

                {/* Attribution */}
                <AttrChip attribution={d.commit.attribution} />

                {/* Author */}
                <span
                  className="text-xs"
                  style={{ color: 'var(--text-tertiary)', flexShrink: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {d.commit.authorName}
                </span>

                {/* Time */}
                <span
                  className="text-xs"
                  style={{ color: 'var(--text-tertiary)', flexShrink: 0, width: 64, textAlign: 'right' }}
                >
                  {relativeTime(d.commit.committedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
