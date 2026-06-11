import { useQuery } from '@tanstack/react-query';
import { fetchAnalyticsStats } from '../../api/analytics';
import type { DaysRange } from '../../api/analytics';
import { queryKeys } from '../../lib/queryKeys';
import { formatTokens } from '../../lib/utils';
import { StatCard } from '../../components/common/StatCard';
import { InsightCallout, FeatureUsageSection, ProjectRow, ModelRow } from './components';
import { TokenLineChart, ActivityHourChart, PlanDoughnutChart, TopToolsChart } from './charts';

export function OverviewTab({ days }: { days: DaysRange }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.analyticsStats(days),
    queryFn: () => fetchAnalyticsStats(days),
    staleTime: 5 * 60 * 1000,
  });

  const loading = isLoading && !stats;

  return (
    <>
      {/* Overview stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6 flex-shrink-0">
        <StatCard label="Sessions" value={loading ? '…' : stats?.overview.total_sessions ?? 0} />
        <StatCard label="Messages" value={loading ? '…' : stats?.overview.total_messages ?? 0} />
        <StatCard label="Tool Calls" value={loading ? '…' : stats?.overview.total_tool_calls ?? 0} />
        <StatCard
          label="Plan Sessions"
          value={loading ? '…' : stats?.overview.plan_sessions ?? 0}
          sub={stats ? `${stats.overview.regular_sessions} regular` : undefined}
        />
        <StatCard label="Active Days" value={loading ? '…' : stats?.overview.active_days ?? 0} />
        <StatCard
          label="Input Tokens"
          value={loading ? '…' : stats ? formatTokens(stats.tokens.input_tokens) : 0}
          sub={stats ? `${formatTokens(stats.tokens.output_tokens)} output` : undefined}
        />
      </div>

      {/* Feature usage */}
      {stats?.feature_usage && (
        <FeatureUsageSection feature={stats.feature_usage} total={stats.overview.total_sessions} />
      )}

      {/* Insight callouts */}
      {stats && stats.insights.length > 0 && (
        <div className="flex flex-col gap-2 flex-shrink-0">
          {stats.insights.map((ins) => (
            <InsightCallout key={ins.type} insight={ins} />
          ))}
        </div>
      )}

      {/* Charts row 1: Token usage + Activity by hour */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="card px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Token usage over time
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : (
            <TokenLineChart data={stats?.tokens.by_day ?? []} />
          )}
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Activity by hour of day
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : (
            <ActivityHourChart
              data={stats?.activity.by_hour ?? Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))}
            />
          )}
        </div>
      </div>

      {/* Charts row 2: Plan vs Regular + Top tools */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="card px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Plan vs Regular sessions
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : (
            <PlanDoughnutChart
              plan={stats?.overview.plan_sessions ?? 0}
              regular={stats?.overview.regular_sessions ?? 0}
            />
          )}
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Top 10 tools
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : (
            <TopToolsChart tools={stats?.tools.top_tools ?? []} />
          )}
        </div>
      </div>

      {/* Bottom row: Projects + Models */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="card px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Top projects
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-5" />
              ))}
            </div>
          ) : stats?.projects.length ? (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {stats.projects.map((p) => (
                <ProjectRow key={p.project} project={p} />
              ))}
            </div>
          ) : (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
              No data
            </p>
          )}
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Models used
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-5" />
              ))}
            </div>
          ) : stats?.models.length ? (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {stats.models.map((m) => (
                <ModelRow key={m.model} model={m} />
              ))}
            </div>
          ) : (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
              No data
            </p>
          )}
        </div>
      </div>

      {/* Token breakdown footer */}
      {stats && (
        <div className="card px-4 py-3 flex flex-wrap gap-6 flex-shrink-0">
          <div>
            <span className="text-xs uppercase tracking-wider block mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Input tokens
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatTokens(stats.tokens.input_tokens)}
            </span>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider block mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Output tokens
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatTokens(stats.tokens.output_tokens)}
            </span>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider block mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Cache read
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatTokens(stats.tokens.cache_read_tokens)}
            </span>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider block mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Cache creation
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatTokens(stats.tokens.cache_creation_tokens)}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
