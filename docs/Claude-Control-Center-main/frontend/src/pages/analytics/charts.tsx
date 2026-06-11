import 'chart.js/auto';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  ACCENT,
  GREEN,
  ORANGE,
  TICK_COLOR,
  GRID_COLOR,
  TOOLTIP_BG,
  TITLE_COLOR,
  QUALITY_HIGH_COLOR,
  QUALITY_MED_COLOR,
  QUALITY_LOW_COLOR,
  baseChartOptions,
} from '../../lib/chartTheme';
import { EmptyState } from '../../components/common/EmptyState';
import type {
  AnalyticsDayBucket,
  AnalyticsHourBucket,
  AnalyticsTool,
  AnalyticsQuality,
  CodeburnStats,
} from '../../api/analytics';

export function EmptyChart() {
  return <EmptyState message="No data for this period" height={120} />;
}

export function TokenLineChart({ data }: { data: AnalyticsDayBucket[] }) {
  if (!data.length) return <EmptyChart />;
  const chartData = {
    labels: data.map((d) => d.date.slice(5)), // "MM-DD"
    datasets: [
      {
        label: 'Input tokens',
        data: data.map((d) => d.input),
        borderColor: ACCENT,
        backgroundColor: 'rgba(14,203,190,0.10)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      },
      {
        label: 'Output tokens',
        data: data.map((d) => d.output),
        borderColor: GREEN,
        backgroundColor: 'rgba(63,185,80,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      },
    ],
  };
  const options = {
    ...baseChartOptions,
    scales: {
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, maxTicksLimit: 10 } },
      y: baseChartOptions.scales.y,
    },
  };
  return (
    <div style={{ height: 200 }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

export function ActivityHourChart({ data }: { data: AnalyticsHourBucket[] }) {
  const chartData = {
    labels: data.map((d) => `${String(d.hour).padStart(2, '0')}h`),
    datasets: [
      {
        label: 'Messages',
        data: data.map((d) => d.count),
        backgroundColor: `${ACCENT}b3`,
        borderRadius: 3,
      },
    ],
  };
  const options = {
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, legend: { display: false } },
    scales: {
      x: { ...baseChartOptions.scales.x, grid: { display: false } },
      y: baseChartOptions.scales.y,
    },
  };
  return (
    <div style={{ height: 200 }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

export function PlanDoughnutChart({ plan, regular }: { plan: number; regular: number }) {
  if (plan + regular === 0) return <EmptyChart />;
  const chartData = {
    labels: ['Plan sessions', 'Regular sessions'],
    datasets: [
      {
        data: [plan, regular],
        backgroundColor: [`${ACCENT}cc`, 'rgba(139,148,158,0.4)'],
        borderColor: [ACCENT, '#404852'],
        borderWidth: 1,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: TICK_COLOR, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: TOOLTIP_BG,
        titleColor: TITLE_COLOR,
        bodyColor: TICK_COLOR,
      },
    },
    cutout: '65%',
  };
  return (
    <div style={{ height: 200 }}>
      <Doughnut data={chartData} options={options} />
    </div>
  );
}

export function TopToolsChart({ tools }: { tools: AnalyticsTool[] }) {
  if (!tools.length) return <EmptyChart />;
  const chartData = {
    labels: tools.map((t) => t.name),
    datasets: [
      {
        label: 'Calls',
        data: tools.map((t) => t.count),
        backgroundColor: `${ACCENT}a6`,
        borderRadius: 3,
      },
    ],
  };
  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: TOOLTIP_BG,
        titleColor: TITLE_COLOR,
        bodyColor: TICK_COLOR,
      },
    },
    scales: {
      x: {
        ticks: { color: TICK_COLOR, font: { size: 10 } },
        grid: { color: GRID_COLOR },
      },
      y: {
        ticks: { color: TICK_COLOR, font: { size: 10 } },
        grid: { display: false },
      },
    },
  };
  return (
    <div style={{ height: Math.max(200, tools.length * 34) }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

export function QualityDistributionChart({ distribution }: { distribution: AnalyticsQuality['distribution'] }) {
  const { high, medium, low } = distribution;
  if (high + medium + low === 0) return <EmptyChart />;
  const chartData = {
    labels: ['High (67–100)', 'Medium (33–66)', 'Low (0–32)'],
    datasets: [{
      data: [high, medium, low],
      backgroundColor: [`${QUALITY_HIGH_COLOR}cc`, `${QUALITY_MED_COLOR}cc`, `${QUALITY_LOW_COLOR}cc`],
      borderColor: [QUALITY_HIGH_COLOR, QUALITY_MED_COLOR, QUALITY_LOW_COLOR],
      borderWidth: 1,
    }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: TICK_COLOR, font: { size: 11 } } },
      tooltip: { backgroundColor: TOOLTIP_BG, titleColor: TITLE_COLOR, bodyColor: TICK_COLOR },
    },
    cutout: '60%',
  };
  return <div style={{ height: 200 }}><Doughnut data={chartData} options={options} /></div>;
}

export function SignalAdoptionChart({ signals }: { signals: AnalyticsQuality['signals'] }) {
  const chartData = {
    labels: ['Verification', 'Auto mode', 'Plan mode'],
    datasets: [{
      label: '% of sessions',
      data: [signals.verification_pct, signals.auto_pct, signals.plan_pct],
      backgroundColor: [`${ACCENT}a6`, '#f97316a6', `${GREEN}a6`],
      borderRadius: 3,
    }],
  };
  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: TOOLTIP_BG,
        titleColor: TITLE_COLOR,
        bodyColor: TICK_COLOR,
        callbacks: { label: (ctx: { parsed: { x: number } }) => ` ${ctx.parsed.x}% of sessions` },
      },
    },
    scales: {
      x: {
        min: 0, max: 100,
        ticks: { color: TICK_COLOR, font: { size: 10 }, callback: (v: number | string) => `${v}%` },
        grid: { color: GRID_COLOR },
      },
      y: { ticks: { color: TICK_COLOR, font: { size: 11 } }, grid: { display: false } },
    },
  };
  return <div style={{ height: 160 }}><Bar data={chartData} options={options as Parameters<typeof Bar>[0]['options']} /></div>;
}

export function CostLineChart({ data, rate }: { data: { date: string; cost_usd: number }[]; rate: number }) {
  if (!data.length) return <EmptyChart />;
  const chartData = {
    labels: data.map((d) => d.date.slice(5)),
    datasets: [
      {
        label: 'Cost (CAD)',
        data: data.map((d) => +(d.cost_usd * rate).toFixed(4)),
        borderColor: ORANGE,
        backgroundColor: 'rgba(249,115,22,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      },
    ],
  };
  const options = {
    ...baseChartOptions,
    plugins: {
      ...baseChartOptions.plugins,
      tooltip: {
        ...baseChartOptions.plugins.tooltip,
        callbacks: {
          label: (ctx: { parsed: { y: number } }) => ` CA$${ctx.parsed.y.toFixed(4)}`,
        },
      },
    },
    scales: {
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, maxTicksLimit: 10 } },
      y: {
        ...baseChartOptions.scales.y,
        ticks: {
          ...baseChartOptions.scales.y.ticks,
          callback: (v: number | string) => `CA$${Number(v).toFixed(2)}`,
        },
      },
    },
  };
  return (
    <div style={{ height: 200 }}>
      <Line data={chartData} options={options as Parameters<typeof Line>[0]['options']} />
    </div>
  );
}

export function CategoryChart({ categories, rate }: { categories: CodeburnStats['task_categories']; rate: number }) {
  if (!categories.length) return <EmptyChart />;
  const chartData = {
    labels: categories.map((c) => c.label),
    datasets: [
      {
        label: 'Cost (CAD)',
        data: categories.map((c) => +(c.cost_usd * rate).toFixed(4)),
        backgroundColor: `${ORANGE}a6`,
        borderRadius: 3,
      },
    ],
  };
  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: TOOLTIP_BG,
        titleColor: TITLE_COLOR,
        bodyColor: TICK_COLOR,
        callbacks: {
          label: (ctx: { parsed: { x: number }; dataIndex: number }) =>
            ` CA$${ctx.parsed.x.toFixed(4)} · ${categories[ctx.dataIndex]?.count ?? 0} sessions`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: TICK_COLOR,
          font: { size: 10 },
          callback: (v: number | string) => `CA$${Number(v).toFixed(2)}`,
        },
        grid: { color: GRID_COLOR },
      },
      y: { ticks: { color: TICK_COLOR, font: { size: 10 } }, grid: { display: false } },
    },
  };
  return (
    <div style={{ height: Math.max(200, categories.length * 34) }}>
      <Bar data={chartData} options={options as Parameters<typeof Bar>[0]['options']} />
    </div>
  );
}
