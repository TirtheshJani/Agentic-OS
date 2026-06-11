import type { CommitAttribution, GitCommit } from '../../types';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

export const LANE_W = 18;
export const ROW_H = 40;

const LANE_COLORS = [
  '#0ecfc0', // teal
  '#a855f7', // purple
  '#22c55e', // green
  '#f97316', // orange
  '#3b82f6', // blue
  '#ec4899', // pink
  '#eab308', // yellow
  '#14b8a6', // teal-alt
];

export const ATTR_COLORS: Record<CommitAttribution, string> = {
  claude: '#0ecfc0',
  codex: '#a855f7',
  user: '#22c55e',
  unknown: '#6b7280',
};

export const ATTR_LABELS: Record<CommitAttribution, string> = {
  claude: 'Claude',
  codex: 'Codex',
  user: 'You',
  unknown: '?',
};

export const ATTR_BG: Record<CommitAttribution, string> = {
  claude: 'rgba(14,207,192,0.15)',
  codex: 'rgba(168,85,247,0.15)',
  user: 'rgba(34,197,94,0.15)',
  unknown: 'rgba(107,114,128,0.15)',
};

export function getLaneColor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length];
}

export function laneX(lane: number): number {
  return lane * LANE_W + LANE_W / 2;
}

// ---------------------------------------------------------------------------
// Lane computation
// ---------------------------------------------------------------------------

export interface DotLine {
  from: number;
  to: number;
  type: 'straight' | 'fork' | 'merge';
}

export interface LaneData {
  commit: GitCommit;
  myLane: number;
  lanesBefore: (string | null)[];
  lanesAfter: (string | null)[];
  dotLines: DotLine[];
}

export function computeLanes(commits: GitCommit[]): LaneData[] {
  const openLanes: (string | null)[] = [];
  const result: LaneData[] = [];

  for (const commit of commits) {
    const lanesBefore = [...openLanes];

    let myLane = openLanes.findIndex((h) => h === commit.hash);
    if (myLane === -1) {
      const free = openLanes.findIndex((h) => h === null);
      myLane = free !== -1 ? free : openLanes.length;
      if (free !== -1) {
        openLanes[myLane] = commit.hash;
      } else {
        openLanes.push(commit.hash);
      }
    }
    openLanes[myLane] = null;

    const dotLines: DotLine[] = [];
    commit.parents.forEach((parentHash, idx) => {
      const el = openLanes.findIndex((h) => h === parentHash);
      if (el !== -1) {
        dotLines.push({ from: myLane, to: el, type: 'merge' });
      } else if (idx === 0) {
        openLanes[myLane] = parentHash;
        dotLines.push({ from: myLane, to: myLane, type: 'straight' });
      } else {
        const free = openLanes.findIndex((h) => h === null);
        const nl = free !== -1 ? free : openLanes.length;
        if (free !== -1) {
          openLanes[nl] = parentHash;
        } else {
          openLanes.push(parentHash);
        }
        dotLines.push({ from: myLane, to: nl, type: 'fork' });
      }
    });

    const lanesAfter = [...openLanes];

    result.push({ commit, myLane, lanesBefore, lanesAfter, dotLines });
  }

  return result;
}
