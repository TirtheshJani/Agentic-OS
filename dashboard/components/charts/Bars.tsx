"use client";

export interface BarSeries {
  label: string;
  values: number[];
  /** Tailwind-safe fill via currentColor wrappers is overkill; use explicit fills. */
  fill: string;
}

/** Minimal grouped bar chart: pure SVG, native <title> tooltips. */
export function Bars({ labels, series, height = 160 }: { labels: string[]; series: BarSeries[]; height?: number }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const n = labels.length;
  if (n === 0) return <p className="text-sm text-gray-500">No data.</p>;
  const groupWidth = 100 / n;
  const barWidth = groupWidth / (series.length + 0.5);

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {labels.map((label, i) =>
        series.map((s, j) => {
          const v = s.values[i] ?? 0;
          const h = (v / max) * (height - 18);
          return (
            <rect
              key={`${i}-${j}`}
              x={i * groupWidth + j * barWidth + barWidth * 0.25}
              y={height - 14 - h}
              width={barWidth * 0.9}
              height={h}
              fill={s.fill}
              rx={0.4}
            >
              <title>{`${label} — ${s.label}: ${v.toLocaleString()}`}</title>
            </rect>
          );
        })
      )}
    </svg>
  );
}
