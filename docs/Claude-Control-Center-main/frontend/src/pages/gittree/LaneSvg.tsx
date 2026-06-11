import { ATTR_COLORS, getLaneColor, laneX, LANE_W, ROW_H, type LaneData } from './lanes';

interface LaneSvgProps {
  data: LaneData;
  maxLanes: number;
}

export function LaneSvg({ data, maxLanes }: LaneSvgProps) {
  const { myLane, lanesBefore, lanesAfter, dotLines, commit } = data;
  const svgWidth = Math.max(maxLanes, myLane + 1) * LANE_W + LANE_W / 2;

  const coveredByDot = new Set(dotLines.map((l) => l.to));
  const paths: React.ReactNode[] = [];

  // Top half: lanes entering from above
  lanesBefore.forEach((hash, i) => {
    if (hash === null) return;
    const color = getLaneColor(i);
    if (hash === commit.hash) {
      // This lane was waiting for this commit — draw line into dot
      if (i === myLane) {
        paths.push(
          <line
            key={`top-${i}`}
            x1={laneX(i)} y1={0}
            x2={laneX(myLane)} y2={ROW_H / 2}
            stroke={color} strokeWidth={2}
          />
        );
      }
      // Merge source lines handled separately below
    } else {
      // Passthrough top
      paths.push(
        <line
          key={`top-${i}`}
          x1={laneX(i)} y1={0}
          x2={laneX(i)} y2={ROW_H / 2}
          stroke={color} strokeWidth={2}
        />
      );
    }
  });

  // Merge lines: lanes that had this commit's hash but at a different position
  // (shouldn't normally happen with standard git, but handle edge cases)
  lanesBefore.forEach((hash, i) => {
    if (hash === commit.hash && i !== myLane) {
      paths.push(
        <line
          key={`merge-in-${i}`}
          x1={laneX(i)} y1={0}
          x2={laneX(myLane)} y2={ROW_H / 2}
          stroke={getLaneColor(i)} strokeWidth={2}
        />
      );
    }
  });

  // Bottom half: dot lines to parents
  dotLines.forEach((dl, idx) => {
    const color = getLaneColor(dl.from);
    paths.push(
      <line
        key={`dot-${idx}`}
        x1={laneX(dl.from)} y1={ROW_H / 2}
        x2={laneX(dl.to)} y2={ROW_H}
        stroke={color} strokeWidth={2}
      />
    );
  });

  // Passthrough bottom: lanes in lanesAfter not covered by dotLines
  lanesAfter.forEach((hash, i) => {
    if (hash === null) return;
    if (coveredByDot.has(i)) return;
    // Check it was also a passthrough from top (not freshly created by a fork)
    const wasInBefore = lanesBefore[i] != null && lanesBefore[i] !== commit.hash;
    if (wasInBefore) {
      paths.push(
        <line
          key={`pass-${i}`}
          x1={laneX(i)} y1={ROW_H / 2}
          x2={laneX(i)} y2={ROW_H}
          stroke={getLaneColor(i)} strokeWidth={2}
        />
      );
    }
  });

  // Commit circle
  const attrColor = ATTR_COLORS[commit.attribution];
  paths.push(
    <circle
      key="dot"
      cx={laneX(myLane)}
      cy={ROW_H / 2}
      r={5}
      fill={attrColor}
      stroke={attrColor}
      strokeWidth={1.5}
    />
  );

  return (
    <svg
      width={svgWidth}
      height={ROW_H}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {paths}
    </svg>
  );
}
