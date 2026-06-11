import { useMemo, useState } from 'react';
import { Database, Layers, BookOpen, Loader2, Clock, ShieldCheck, AlertTriangle, Hash } from 'lucide-react';
import { useSemanticCatalog, useSemanticQuery } from '../hooks/useSemanticLayer';
import type { SemanticDays, SemanticMetric, SemanticQueryRow } from '../api/semanticLayer';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatValue(value: number, unit: string): string {
  if (unit === 'usd') {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (unit === 'tokens') {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return String(Math.round(value));
  }
  if (unit === 'score') return value.toFixed(1);
  return Math.round(value).toLocaleString();
}

function relativeAge(ageSeconds: number | null): string {
  if (ageSeconds == null) return 'never scanned';
  if (ageSeconds < 60) return `${ageSeconds}s ago`;
  if (ageSeconds < 3600) return `${Math.round(ageSeconds / 60)}m ago`;
  if (ageSeconds < 86400) return `${Math.round(ageSeconds / 3600)}h ago`;
  return `${Math.round(ageSeconds / 86400)}d ago`;
}

const UNIT_COLORS: Record<string, string> = {
  usd: 'var(--green-500)',
  tokens: 'var(--navy-500)',
  count: 'var(--steel-500)',
  score: 'var(--orange-500)',
};

const TYPE_LABELS: Record<string, string> = {
  categorical: 'Categorical',
  temporal: 'Temporal',
  boolean: 'Boolean',
};

const DAYS_OPTIONS: { value: SemanticDays; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 'all', label: 'All' },
];

// ---------------------------------------------------------------------------
// Explore tab
// ---------------------------------------------------------------------------

function RowBar({ row, max, unit }: { row: SemanticQueryRow; max: number; unit: string }) {
  const pct = max > 0 ? (row.value / max) * 100 : 0;
  const color = UNIT_COLORS[unit] ?? 'var(--accent)';
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div
        className="text-xs truncate"
        style={{ width: 160, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono-ds)' }}
        title={row.group}
      >
        {row.group}
      </div>
      <div className="flex-1 relative" style={{ height: 18 }}>
        <div
          style={{
            position: 'absolute', inset: 0, width: `${pct}%`,
            background: color, opacity: 0.22, borderRadius: 2,
            transition: 'width 0.3s ease',
          }}
        />
        <div
          className="absolute inset-y-0 left-2 flex items-center text-xs font-medium"
          style={{ color: 'var(--text-primary)' }}
        >
          {formatValue(row.value, unit)}
        </div>
      </div>
      <div className="text-xs tabular-nums" style={{ width: 64, textAlign: 'right', color: 'var(--text-tertiary)' }}>
        {row.sessions} sess
      </div>
    </div>
  );
}

function ProvenanceFooter({ provenance }: { provenance: import('../api/semanticLayer').SemanticQueryProvenance }) {
  return (
    <div
      className="card px-4 py-3 flex flex-col gap-2 text-xs"
      style={{ borderLeft: '2px solid var(--accent)' }}
    >
      <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>
        <ShieldCheck size={13} style={{ color: 'var(--accent)' }} />
        Provenance
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3" style={{ color: 'var(--text-tertiary)' }}>
        <ProvItem label="Source" value={provenance.source} mono />
        <ProvItem label="Owner" value={provenance.owner} />
        <ProvItem label="Grain" value={provenance.grain} />
        <ProvItem label="Aggregation" value={provenance.aggregation} />
        <ProvItem label="Unit" value={provenance.unit} />
        <ProvItem
          label="Freshness"
          value={relativeAge(provenance.age_seconds)}
          icon={<Clock size={11} />}
        />
      </div>
      <div style={{ color: 'var(--text-tertiary)' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Definition: </span>
        {provenance.definition}
      </div>
      {provenance.gotchas && (
        <div className="flex items-start gap-1.5" style={{ color: 'var(--orange-500)' }}>
          <AlertTriangle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{provenance.gotchas}</span>
        </div>
      )}
      {provenance.hygiene?.length > 0 && (
        <div style={{ color: 'var(--text-tertiary)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Hygiene: </span>
          {provenance.hygiene.join(' ')}
        </div>
      )}
    </div>
  );
}

function ProvItem({
  label, value, mono, icon,
}: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span
        className="flex items-center gap-1"
        style={{ color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono-ds)' : undefined }}
      >
        {icon}{value}
      </span>
    </div>
  );
}

function ExploreTab({
  metrics, dimensions, days,
}: {
  metrics: SemanticMetric[];
  dimensions: import('../api/semanticLayer').SemanticDimension[];
  days: SemanticDays;
}) {
  const [metric, setMetric] = useState(metrics[0]?.key ?? '');
  const [groupBy, setGroupBy] = useState<string>('project');

  const { data, isLoading } = useSemanticQuery({ metric, groupBy: groupBy || null, days }, !!metric);

  const max = useMemo(
    () => (data?.rows ?? []).reduce((m, r) => Math.max(m, r.value), 0),
    [data],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="card px-4 py-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Metric
          <select className="input-field text-xs" value={metric} onChange={(e) => setMetric(e.target.value)}>
            {metrics.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </label>
        <span className="text-xs pb-2" style={{ color: 'var(--text-tertiary)' }}>by</span>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Dimension
          <select className="input-field text-xs" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="">— total —</option>
            {dimensions.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-16 justify-center" style={{ color: 'var(--text-tertiary)' }}>
          <Loader2 size={16} className="animate-spin" /> Resolving metric…
        </div>
      ) : data ? (
        <>
          {/* Total */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="card px-4 py-3 flex flex-col gap-1">
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{data.metric.label}</span>
              <span className="text-xl font-semibold" style={{ color: UNIT_COLORS[data.metric.unit] ?? 'var(--text-primary)' }}>
                {formatValue(data.total, data.metric.unit)}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {data.provenance.aggregation} · {data.metric.grain} grain
              </span>
            </div>
            <div className="card px-4 py-3 flex flex-col gap-1">
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sessions in scope</span>
              <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{data.session_count}</span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                window: {data.provenance.window_days == null ? 'all time' : `${data.provenance.window_days}d`}
              </span>
            </div>
            {data.dimension && (
              <div className="card px-4 py-3 flex flex-col gap-1">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Grouped by</span>
                <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{data.dimension.label}</span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{data.rows.length} buckets</span>
              </div>
            )}
          </div>

          {/* Rows */}
          {data.dimension && (
            <div className="card px-4 py-4">
              {data.rows.length === 0 ? (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  No data in this window.
                </div>
              ) : (
                <div className="flex flex-col">
                  {data.rows.map((row) => (
                    <RowBar key={row.group} row={row} max={max} unit={data.metric.unit} />
                  ))}
                </div>
              )}
            </div>
          )}

          <ProvenanceFooter provenance={data.provenance} />
        </>
      ) : (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          No cached analytics yet. Run an Analytics scan first.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catalog tab
// ---------------------------------------------------------------------------

function MetricCard({ metric }: { metric: SemanticMetric }) {
  const color = UNIT_COLORS[metric.unit] ?? 'var(--accent)';
  return (
    <div className="card px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Hash size={13} style={{ color }} />
        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{metric.label}</span>
        <code className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono-ds)' }}>
          {metric.key}
        </code>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{metric.description}</p>
      <div className="flex flex-wrap gap-1.5">
        <span className="chip text-xs" style={{ background: 'rgba(255,255,255,0.05)' }}>{metric.aggregation}</span>
        <span className="chip text-xs" style={{ background: 'rgba(255,255,255,0.05)' }}>{metric.unit}</span>
        <span className="chip text-xs" style={{ background: 'rgba(255,255,255,0.05)' }}>{metric.grain} grain</span>
        <span className="chip text-xs" style={{ background: 'rgba(255,255,255,0.05)' }}>owner: {metric.owner}</span>
      </div>
      {metric.gotchas && (
        <div className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--orange-500)' }}>
          <AlertTriangle size={11} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{metric.gotchas}</span>
        </div>
      )}
    </div>
  );
}

function CatalogTab({ catalog }: { catalog: import('../api/semanticLayer').SemanticCatalog }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Layers size={14} style={{ color: 'var(--accent)' }} /> Metrics
          <span className="text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>
            ({catalog.metrics.length} governed measures)
          </span>
        </h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {catalog.metrics.map((m) => <MetricCard key={m.key} metric={m} />)}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Database size={14} style={{ color: 'var(--accent)' }} /> Dimensions
          <span className="text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>
            ({catalog.dimensions.length} legal slices)
          </span>
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.dimensions.map((d) => (
            <div key={d.key} className="card px-4 py-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{d.label}</span>
                <span className="chip text-xs" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {TYPE_LABELS[d.type] ?? d.type}
                </span>
              </div>
              <code className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono-ds)' }}>{d.key}</code>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{d.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card px-4 py-3 flex flex-col gap-2">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <ShieldCheck size={14} style={{ color: 'var(--accent)' }} /> Standard hygiene
        </h2>
        <ul className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {catalog.hygiene.map((h) => (
            <li key={h} className="flex items-start gap-1.5">
              <span style={{ color: 'var(--accent)' }}>·</span>{h}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = 'explore' | 'catalog';

export function SemanticLayerPage() {
  const [tab, setTab] = useState<Tab>('explore');
  const [days, setDays] = useState<SemanticDays>(30);
  const { data: catalog, isLoading } = useSemanticCatalog();

  return (
    <div className="flex flex-col" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="p-6 flex flex-col gap-5" style={{ minHeight: '100%' }}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <Database size={18} style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Semantic Layer</h1>
          <span className="text-xs hidden sm:block" style={{ color: 'var(--text-tertiary)' }}>
            governed metrics over your session data
          </span>
          <div className="flex-1" />
          {tab === 'explore' && (
            <div className="flex gap-1">
              {DAYS_OPTIONS.map((o) => (
                <button
                  key={String(o.value)}
                  className="chip text-xs"
                  style={{
                    background: days === o.value ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
                    color: days === o.value ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                  onClick={() => setDays(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {([['explore', Layers, 'Explore'], ['catalog', BookOpen, 'Catalog']] as const).map(([t, Icon, label]) => (
            <button
              key={t}
              className="chip flex items-center gap-1.5"
              style={{
                background: tab === t ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
                color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
              }}
              onClick={() => setTab(t)}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading || !catalog ? (
          <div className="flex items-center gap-2 py-16 justify-center" style={{ color: 'var(--text-tertiary)' }}>
            <Loader2 size={16} className="animate-spin" /> Loading catalog…
          </div>
        ) : tab === 'explore' ? (
          <ExploreTab metrics={catalog.metrics} dimensions={catalog.dimensions} days={days} />
        ) : (
          <CatalogTab catalog={catalog} />
        )}
      </div>
    </div>
  );
}
