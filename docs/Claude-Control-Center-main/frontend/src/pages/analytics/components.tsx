import { AlertTriangle, Info, Monitor, Zap, Brain } from 'lucide-react';
import { formatTokens } from '../../lib/utils';
import type {
  AnalyticsInsight,
  AnalyticsFeatureUsage,
  AnalyticsProject,
  AnalyticsModel,
} from '../../api/analytics';

export function InsightCallout({ insight }: { insight: AnalyticsInsight }) {
  const isWarning = insight.severity === 'warning';
  return (
    <div
      className="flex gap-3 rounded-lg px-4 py-3"
      style={{
        background: isWarning ? 'rgba(210,153,34,0.08)' : 'oklch(71% 0.185 192 / 0.08)',
        border: `1px solid ${isWarning ? 'rgba(210,153,34,0.25)' : 'oklch(71% 0.185 192 / 0.25)'}`,
      }}
    >
      {isWarning ? (
        <AlertTriangle size={15} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
      ) : (
        <Info size={15} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
      )}
      <div>
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {insight.title}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {insight.description}
        </div>
      </div>
    </div>
  );
}

export function FeatureUsageSection({ feature, total }: { feature: AnalyticsFeatureUsage; total: number }) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const items = [
    {
      icon: <Brain size={14} />,
      label: 'Auto mode',
      count: feature.auto_mode_sessions,
      pct: pct(feature.auto_mode_sessions),
      color: '#0ecbbe', // teal accent
    },
    {
      icon: <Monitor size={14} />,
      label: 'Computer use',
      count: feature.computer_use_sessions,
      pct: pct(feature.computer_use_sessions),
      color: '#3ec85e', // success green
      sub: feature.computer_use_calls > 0 ? `${feature.computer_use_calls} calls` : undefined,
    },
    {
      icon: <Zap size={14} />,
      label: 'Ultraplan',
      count: feature.ultraplan_sessions,
      pct: pct(feature.ultraplan_sessions),
      color: '#f0883e',
    },
  ];

  return (
    <div className="card px-4 py-3 flex-shrink-0">
      <div
        className="text-xs font-medium uppercase tracking-wider mb-3"
        style={{ color: 'var(--text-tertiary)' }}
      >
        Advanced features
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span style={{ color: item.color }}>{item.icon}</span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {item.label}
              </span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {item.count}
              </span>
              <div className="text-right">
                <span className="text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                  {item.pct}% of sessions
                </span>
                {item.sub && (
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {item.sub}
                  </div>
                )}
              </div>
            </div>
            <div
              className="rounded-full overflow-hidden"
              style={{ height: 3, background: 'rgba(255,255,255,0.08)' }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${item.pct}%`, background: item.color, transition: 'width 0.4s ease' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectRow({ project }: { project: AnalyticsProject }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span
        className="text-xs font-mono flex-1 truncate"
        style={{ color: 'var(--text-secondary)' }}
        title={project.project}
      >
        {project.project}
      </span>
      <span className="text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
        {project.messages} msg
      </span>
      <span
        className="text-xs font-semibold tabular-nums w-14 text-right"
        style={{ color: 'var(--text-primary)' }}
      >
        {formatTokens(project.tokens)}
      </span>
    </div>
  );
}

export function ModelRow({ model }: { model: AnalyticsModel }) {
  const shortModel = model.model.replace('claude-', '').replace(/-\d{8}$/, '');
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span
        className="text-xs font-mono flex-1 truncate"
        style={{ color: 'var(--text-secondary)' }}
        title={model.model}
      >
        {shortModel}
      </span>
      <span className="text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
        {model.messages} msg
      </span>
      <span
        className="text-xs font-semibold tabular-nums w-14 text-right"
        style={{ color: 'var(--text-primary)' }}
      >
        {formatTokens(model.tokens)}
      </span>
    </div>
  );
}
