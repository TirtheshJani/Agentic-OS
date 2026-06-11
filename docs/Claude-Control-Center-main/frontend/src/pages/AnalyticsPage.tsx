import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart2, RefreshCw, Flame, Star } from 'lucide-react';
import { fetchAnalyticsStats, triggerAnalyticsScan } from '../api/analytics';
import type { DaysRange } from '../api/analytics';
import { queryKeys } from '../lib/queryKeys';
import { cn } from '../lib/utils';
import { OverviewTab } from './analytics/OverviewTab';
import { QualityTab } from './analytics/QualityTab';
import { CodeburnTab } from './analytics/CodeburnTab';

const DAYS_OPTIONS: { label: string; value: DaysRange }[] = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: 'All', value: 'all' },
];

type PageTab = 'analytics' | 'codeburn' | 'quality';

export function AnalyticsPage() {
  const [days, setDays] = useState<DaysRange>(30);
  const [activeTab, setActiveTab] = useState<PageTab>('analytics');
  const queryClient = useQueryClient();

  const { mutate: scan, isPending: scanning } = useMutation({
    mutationFn: () => triggerAnalyticsScan(days),
    onSuccess: (data) => {
      queryClient.setQueryData(['analytics-stats', days], data.stats);
      queryClient.invalidateQueries({ queryKey: queryKeys.codeburnStats() });
    },
  });

  const { data: stats } = useQuery({
    queryKey: queryKeys.analyticsStats(days),
    queryFn: () => fetchAnalyticsStats(days),
    staleTime: 5 * 60 * 1000,
  });

  // Scan on mount for fresh data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { scan(); }, []);

  return (
    <div className="p-6 flex flex-col gap-5" style={{ height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <BarChart2 size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Analytics
        </h1>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 ml-1">
          {([
            { id: 'analytics' as PageTab, label: 'Overview', icon: null },
            { id: 'codeburn' as PageTab, label: 'Token Burn', icon: <Flame size={12} /> },
            { id: 'quality' as PageTab, label: 'Quality', icon: <Star size={12} /> },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="chip transition-all flex items-center gap-1"
              style={{
                background: activeTab === tab.id ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'analytics' && stats && (
          <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
            {stats.session_count} session{stats.session_count !== 1 ? 's' : ''}
          </span>
        )}

        {/* Days range selector */}
        <div className="flex items-center gap-1 ml-3">
          {DAYS_OPTIONS.map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => setDays(opt.value)}
              className="chip transition-all"
              style={{
                background: days === opt.value ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
                color: days === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Rescan button — shown on analytics and quality tabs */}
        {(activeTab === 'analytics' || activeTab === 'quality') && (
          <button
            className={cn(
              'ml-auto flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              'hover:bg-white/10',
              scanning && 'opacity-60 pointer-events-none'
            )}
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            onClick={() => scan()}
            disabled={scanning}
          >
            <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} />
            {scanning ? 'Scanning…' : 'Rescan'}
          </button>
        )}
      </div>

      {activeTab === 'analytics' && <OverviewTab days={days} />}
      {activeTab === 'codeburn' && <CodeburnTab days={days} />}
      {activeTab === 'quality' && <QualityTab days={days} />}
    </div>
  );
}
