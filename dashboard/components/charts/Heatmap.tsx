"use client";

/** GitHub-style activity heatmap over the last ~26 weeks. */
export function Heatmap({ data }: { data: Array<{ day: string; value: number }> }) {
  const byDay = new Map(data.map((d) => [d.day, d.value]));
  const max = Math.max(1, ...data.map((d) => d.value));

  const weeks: Array<Array<{ day: string; value: number }>> = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 26 * 7 - today.getDay());
  const cursor = new Date(start);
  while (cursor <= today) {
    const week: Array<{ day: string; value: number }> = [];
    for (let d = 0; d < 7 && cursor <= today; d++) {
      const key = cursor.toISOString().slice(0, 10);
      week.push({ day: key, value: byDay.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const cell = 10;
  const gap = 2;
  return (
    <svg
      width={weeks.length * (cell + gap)}
      height={7 * (cell + gap)}
      role="img"
      aria-label="Activity heatmap"
      className="max-w-full"
    >
      {weeks.map((week, x) =>
        week.map((d, y) => {
          const intensity = d.value === 0 ? 0 : 0.25 + 0.75 * (d.value / max);
          return (
            <rect
              key={d.day}
              x={x * (cell + gap)}
              y={y * (cell + gap)}
              width={cell}
              height={cell}
              rx={2}
              fill={d.value === 0 ? "var(--surface-2)" : "var(--accent)"}
              fillOpacity={d.value === 0 ? 1 : intensity.toFixed(2)}
            >
              <title>{`${d.day}: ${d.value.toLocaleString()}`}</title>
            </rect>
          );
        })
      )}
    </svg>
  );
}
