import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchIngestStatus, fetchIngestLog, triggerIngest } from '../../api/memoryRag';
import { queryKeys } from '../../lib/queryKeys';
import { cn } from '../../lib/utils';

function fmtRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

export function IngestPanel() {
  const qc = useQueryClient();
  const [showLog, setShowLog] = useState(false);

  const { data: status } = useQuery({
    queryKey: queryKeys.ragIngestStatus(),
    queryFn: fetchIngestStatus,
    refetchInterval: 8000,
  });

  const { data: logData } = useQuery({
    queryKey: queryKeys.ragIngestLog(),
    queryFn: () => fetchIngestLog(30),
    enabled: showLog,
    refetchInterval: showLog ? 10000 : false,
  });

  const { mutate: trigger, isPending } = useMutation({
    mutationFn: triggerIngest,
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: queryKeys.ragIngestStatus() });
        qc.invalidateQueries({ queryKey: queryKeys.ragIngestLog() });
        qc.invalidateQueries({ queryKey: queryKeys.ragStatus() });
      }, 2000);
    },
  });

  const isScanning = status?.status === 'scanning';

  const sources = status?.sources ?? {
    claude_code: { scanned: 0, ingested: 0 },
    codex: { scanned: 0, ingested: 0 },
    antigravity: { scanned: 0, ingested: 0 },
  };

  const sourceRows = [
    { key: 'claude_code', label: 'Claude Code', stats: sources.claude_code },
    { key: 'codex', label: 'Codex', stats: sources.codex },
    { key: 'antigravity', label: 'Antigravity', stats: sources.antigravity },
  ];

  return (
    <div className="card px-4 py-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Auto-Ingest
          </span>
          {isScanning ? (
            <span className="chip text-xs" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
              scanning…
            </span>
          ) : (
            <span className="chip text-xs" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>
              idle
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Last: {fmtRelative(status?.last_scan_at ?? null)}
          </span>
          <button
            onClick={() => trigger()}
            disabled={isPending || isScanning}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all disabled:opacity-40',
            )}
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw size={11} className={isPending || isScanning ? 'animate-spin' : ''} />
            Scan now
          </button>
        </div>
      </div>

      {status?.last_error && (
        <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md"
          style={{ background: 'rgba(248,81,73,0.08)', color: 'var(--error)' }}>
          <AlertCircle size={11} />
          {status.last_error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {sourceRows.map(({ key, label, stats }) => (
          <div
            key={key}
            className="rounded-md px-3 py-2 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
          >
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {label}
            </div>
            <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {stats.ingested}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              / {stats.scanned} scanned
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-tertiary)' }}>
        <span>Total ingested: {status?.total_ingested ?? 0}</span>
        <button
          onClick={() => setShowLog(!showLog)}
          className="flex items-center gap-1 hover:text-[var(--text-secondary)] transition-colors"
        >
          Activity log
          {showLog ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {showLog && logData && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {logData.log.length === 0 && (
            <p className="text-xs text-center py-3" style={{ color: 'var(--text-tertiary)' }}>
              No activity yet.
            </p>
          )}
          {[...logData.log].reverse().map((entry, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs px-2 py-1 rounded"
              style={{ color: entry.action === 'error' ? 'var(--error)' : 'var(--text-secondary)' }}
            >
              {entry.action === 'ingested' ? (
                <CheckCircle size={11} className="mt-0.5 shrink-0" style={{ color: '#4ade80' }} />
              ) : entry.action === 'error' ? (
                <AlertCircle size={11} className="mt-0.5 shrink-0" />
              ) : (
                <Clock size={11} className="mt-0.5 shrink-0" />
              )}
              <span className="chip" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                {entry.source}
              </span>
              <span className="truncate flex-1">
                {entry.path.split('/').pop() || entry.path}
                {entry.detail ? ` — ${entry.detail.slice(0, 80)}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
