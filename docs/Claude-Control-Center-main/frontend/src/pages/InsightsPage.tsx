import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { Lightbulb, Copy, Check, AlertCircle } from 'lucide-react';
import { fetchInsights } from '../api/insights';
import type { InsightsBar, InsightsChart, InsightsFeature, InsightsPattern, InsightsHorizon } from '../types';

function reportAge(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handle}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
      style={{
        background: copied ? 'var(--success)' : 'var(--bg-elevated)',
        color: copied ? '#fff' : 'var(--text-secondary)',
        border: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-3 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function BarChart({ chart }: { chart: InsightsChart }) {
  return (
    <div className="card px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
        {chart.title}
      </div>
      <div className="flex flex-col gap-2">
        {chart.bars.map((bar: InsightsBar) => (
          <div key={bar.label} className="flex items-center gap-2">
            <span
              className="text-xs"
              style={{ color: 'var(--text-secondary)', width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={bar.label}
            >
              {bar.label}
            </span>
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: 'var(--bg-elevated)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${bar.pct}%`, background: 'var(--accent)', transition: 'width 0.4s ease' }}
              />
            </div>
            <span className="text-xs font-medium w-8 text-right" style={{ color: 'var(--text-tertiary)' }}>
              {bar.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ feature }: { feature: InsightsFeature }) {
  return (
    <div className="rounded-lg p-4" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
      <div className="font-semibold mb-1" style={{ color: '#166534' }}>{feature.title}</div>
      <div className="text-sm mb-2" style={{ color: '#15803d' }}>{feature.oneliner}</div>
      <div className="text-xs mb-3" style={{ color: '#166534' }}>{feature.why}</div>
      {feature.examples.map((ex, i) => (
        <div key={i} className="mt-2">
          {ex.desc && <div className="text-xs mb-1" style={{ color: '#15803d' }}>{ex.desc}</div>}
          {ex.code && (
            <div className="flex items-start gap-2">
              <pre
                className="flex-1 text-xs p-3 rounded overflow-x-auto"
                style={{ background: 'rgba(255,255,255,0.7)', color: '#166534', border: '1px solid #bbf7d0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {ex.code}
              </pre>
              <CopyButton text={ex.code} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PatternCard({ pattern }: { pattern: InsightsPattern }) {
  return (
    <div className="rounded-lg p-4" style={{ background: '#f0f9ff', border: '1px solid #7dd3fc' }}>
      <div className="font-semibold mb-1" style={{ color: '#0369a1' }}>{pattern.title}</div>
      <div className="text-sm mb-2" style={{ color: '#0284c7' }}>{pattern.summary}</div>
      <div className="text-xs mb-3" style={{ color: '#0369a1' }}>{pattern.detail}</div>
      {pattern.prompt && (
        <>
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>Paste into Claude Code:</div>
          <div className="flex items-start gap-2">
            <pre
              className="flex-1 text-xs p-3 rounded overflow-x-auto"
              style={{ background: 'rgba(255,255,255,0.7)', color: '#0369a1', border: '1px solid #bae6fd', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {pattern.prompt}
            </pre>
            <CopyButton text={pattern.prompt} />
          </div>
        </>
      )}
    </div>
  );
}

function HorizonCard({ card }: { card: InsightsHorizon }) {
  return (
    <div className="rounded-lg p-4" style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)', border: '1px solid #c4b5fd' }}>
      <div className="font-semibold mb-2" style={{ color: '#5b21b6' }}>{card.title}</div>
      <div className="text-sm mb-3" style={{ color: '#334155', lineHeight: 1.6 }}>{card.possible}</div>
      {card.tip && (
        <div className="text-xs mb-3 p-2 rounded" style={{ background: 'rgba(255,255,255,0.6)', color: '#6b21a8' }}>
          {card.tip}
        </div>
      )}
      {card.prompt && (
        <>
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>Paste into Claude Code:</div>
          <div className="flex items-start gap-2">
            <pre
              className="flex-1 text-xs p-3 rounded overflow-x-auto"
              style={{ background: 'rgba(255,255,255,0.6)', color: '#5b21b6', border: '1px solid #ddd6fe', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {card.prompt}
            </pre>
            <CopyButton text={card.prompt} />
          </div>
        </>
      )}
    </div>
  );
}

export function InsightsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.insights(),
    queryFn: fetchInsights,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Lightbulb size={22} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Insights</h1>
          {data && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {data.date_range}
              {' · '}
              <span>Report from {reportAge(data.report_date)}</span>
              {' · '}
              <span>Run <code className="text-xs px-1 rounded" style={{ background: 'var(--bg-elevated)' }}>/insights</code> in Claude Code to refresh</span>
            </p>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="card p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
          Loading insights…
        </div>
      )}

      {/* Empty / error state */}
      {!isLoading && error && (
        <div className="card p-8 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={32} style={{ color: 'var(--text-tertiary)' }} />
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>No report found</div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Run <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)' }}>/insights</code> in Claude Code to generate one, then reload this page.
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Stats bar */}
          {data.stats.length > 0 && (
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(data.stats.length, 5)}, minmax(0, 1fr))` }}>
              {data.stats.map((s) => (
                <StatCard key={s.label} label={s.label} value={s.value} />
              ))}
            </div>
          )}

          {/* Charts */}
          {data.charts.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                Usage Breakdown
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.charts.map((chart) => (
                  <BarChart key={chart.title} chart={chart} />
                ))}
              </div>
            </section>
          )}

          {/* Features to Try */}
          {data.features.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                Existing Features to Try
              </h2>
              <div className="flex flex-col gap-4">
                {data.features.map((f) => (
                  <FeatureCard key={f.title} feature={f} />
                ))}
              </div>
            </section>
          )}

          {/* Usage Patterns */}
          {data.patterns.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                New Usage Patterns
              </h2>
              <div className="flex flex-col gap-4">
                {data.patterns.map((p) => (
                  <PatternCard key={p.title} pattern={p} />
                ))}
              </div>
            </section>
          )}

          {/* On the Horizon */}
          {data.horizon.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
                On the Horizon
              </h2>
              <div className="flex flex-col gap-4">
                {data.horizon.map((h) => (
                  <HorizonCard key={h.title} card={h} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
