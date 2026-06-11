import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Flame } from 'lucide-react';
import { fetchCodeburnStats } from '../../api/analytics';
import type { CodeburnInsight, DaysRange } from '../../api/analytics';
import { queryKeys } from '../../lib/queryKeys';
import { formatTokens } from '../../lib/utils';
import { StatCard } from '../../components/common/StatCard';
import { CostLineChart, CategoryChart } from './charts';

export function formatCAD(usd: number, rate: number): string {
  const cad = usd * rate;
  if (cad < 0.01) return 'CA$0.00';
  if (cad >= 1000) return `CA$${(cad / 1000).toFixed(1)}K`;
  return `CA$${cad.toFixed(2)}`;
}

function shortModel(model: string): string {
  return model.replace('claude-', '').replace(/-\d{8}$/, '');
}

function CodeburnInsightCallout({ insight }: { insight: CodeburnInsight }) {
  const isWarning = insight.severity === 'warning';
  return (
    <div
      className="flex gap-3 rounded-lg px-4 py-3"
      style={{
        background: isWarning ? 'rgba(210,153,34,0.08)' : 'rgba(251,146,60,0.08)',
        border: `1px solid ${isWarning ? 'rgba(210,153,34,0.25)' : 'rgba(251,146,60,0.25)'}`,
      }}
    >
      {isWarning ? (
        <AlertTriangle size={15} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
      ) : (
        <Flame size={15} style={{ color: '#f97316', flexShrink: 0, marginTop: 1 }} />
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

function CostRow({ label, cost, sub, rate }: { label: string; cost: number; sub?: string; rate: number }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-secondary)' }} title={label}>
        {label}
      </span>
      {sub && (
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
          {sub}
        </span>
      )}
      <span className="text-xs font-semibold tabular-nums w-20 text-right" style={{ color: 'var(--text-primary)' }}>
        {formatCAD(cost, rate)}
      </span>
    </div>
  );
}

export function CodeburnTab({ days }: { days: DaysRange }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.codeburnStats(days),
    queryFn: () => fetchCodeburnStats(days),
    staleTime: 5 * 60 * 1000,
  });

  const loading = isLoading && !data;
  const rate = data?.exchange_rate ?? 1;

  return (
    <div className="flex flex-col gap-5">
      {/* Cost stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 flex-shrink-0">
        <StatCard
          label="Total Cost (CAD)"
          value={loading ? '…' : formatCAD(data?.total_cost_usd ?? 0, rate)}
          sub={data ? `${data.session_count} sessions` : undefined}
        />
        <StatCard
          label="Cache Hit %"
          value={loading ? '…' : `${data?.cache_efficiency.cache_hit_pct ?? 0}%`}
          sub={data ? `${formatTokens(data.cache_efficiency.tokens_saved)} tokens reused` : undefined}
        />
        <StatCard
          label="Cache Savings"
          value={loading ? '…' : formatCAD(data?.cache_efficiency.cost_saved_usd ?? 0, rate)}
          sub="vs full input price"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="card px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Cost over time (CAD)
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : (
            <CostLineChart data={data?.cost_by_day ?? []} rate={rate} />
          )}
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Cost by task category
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : (
            <CategoryChart categories={data?.task_categories ?? []} rate={rate} />
          )}
        </div>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="card px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Cost by model
          </div>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-5" />)}</div>
          ) : data?.cost_by_model.length ? (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {data.cost_by_model.map((m) => (
                <CostRow key={m.model} label={shortModel(m.model)} sub={`${m.sessions} sess`} cost={m.cost_usd} rate={rate} />
              ))}
            </div>
          ) : (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No data</p>
          )}
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Cost by project
          </div>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-5" />)}</div>
          ) : data?.cost_by_project.length ? (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {data.cost_by_project.map((p) => (
                <CostRow key={p.project} label={p.project} sub={`${p.sessions} sess`} cost={p.cost_usd} rate={rate} />
              ))}
            </div>
          ) : (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No data</p>
          )}
        </div>
      </div>

      {/* Cost insights */}
      {data && data.cost_insights.length > 0 && (
        <div className="flex flex-col gap-2 flex-shrink-0">
          {data.cost_insights.map((ins) => (
            <CodeburnInsightCallout key={ins.type} insight={ins} />
          ))}
        </div>
      )}

      {/* Footnote */}
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        Cost estimates based on published Claude API pricing. Exchange rate: 1 USD = {rate.toFixed(4)} CAD (cached 24 h).
      </p>
    </div>
  );
}
