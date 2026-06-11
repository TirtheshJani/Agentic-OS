import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FlaskConical, Plus, X, Trash2, RefreshCw, ChevronDown, ChevronUp, Play, BookOpen, Download,
} from 'lucide-react';
import {
  fetchResearchJobs, createResearchJob, deleteResearchJob, runResearchJob,
  fetchResearchSourceStatus, fetchResearchJobLog, importFromVault,
} from '../api/research';
import { fetchVaults } from '../api/obsidian';
import type { ResearchJob } from '../api/research';
import { absoluteTime } from '../lib/utils';
import { cn } from '../lib/utils';
import { queryKeys } from '../lib/queryKeys';

const STANDARD_SOURCES = ['youtube', 'reddit', 'web'] as const;
const ALL_SOURCES = [...STANDARD_SOURCES, 'vault_pipeline'] as const;
type Source = typeof ALL_SOURCES[number];

function StatusBadge({ status }: { status: ResearchJob['status'] }) {
  const cfg = {
    pending: { label: 'Pending', bg: 'rgba(255,255,255,0.06)', color: 'var(--text-tertiary)' },
    running: { label: 'Running', bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
    done: { label: 'Done', bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
    failed: { label: 'Failed', bg: 'rgba(248,81,73,0.12)', color: '#f85149' },
  }[status];

  return (
    <span
      className={cn('chip text-xs', status === 'running' && 'animate-pulse')}
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function SourceChip({ source, available }: { source: string; available: boolean }) {
  const isVault = source === 'vault_pipeline';
  const label = isVault ? 'vault wiki' : source;
  return (
    <span
      className="chip text-xs capitalize"
      style={isVault
        ? { background: available ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.05)', color: available ? '#a78bfa' : 'var(--text-tertiary)' }
        : { background: available ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)', color: available ? '#4ade80' : 'var(--text-tertiary)' }}
    >
      {label}
    </span>
  );
}

function VaultPipelineLog({ jobId, status }: { jobId: string; status: ResearchJob['status'] }) {
  const logRef = useRef<HTMLPreElement>(null);

  const { data } = useQuery({
    queryKey: queryKeys.researchJobLog(jobId),
    queryFn: () => fetchResearchJobLog(jobId),
    refetchInterval: status === 'running' ? 3000 : false,
    staleTime: status === 'running' ? 0 : Infinity,
  });

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [data?.log]);

  if (!data?.log) return null;

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
        Pipeline log {status === 'running' && <span className="animate-pulse">·</span>}
      </div>
      <pre
        ref={logRef}
        className="rounded-md p-3 text-[11px] leading-relaxed overflow-auto"
        style={{
          background: 'rgba(0,0,0,0.35)',
          color: '#a8b1c0',
          border: '1px solid var(--border)',
          maxHeight: 320,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        {data.log}
      </pre>
    </div>
  );
}

function JobRow({ job }: { job: ResearchJob }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const isVaultPipeline = job.sources.includes('vault_pipeline');

  const { mutate: del, isPending: deleting } = useMutation({
    mutationFn: () => deleteResearchJob(job.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.researchJobs() }),
  });

  const { mutate: run, isPending: running } = useMutation({
    mutationFn: () => runResearchJob(job.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.researchJobs() }),
  });

  const resultEntries = Object.entries(job.results).filter(([, items]) => items.length > 0);

  return (
    <>
      <div
        className="grid gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
        style={{ gridTemplateColumns: 'minmax(0,2fr) 1fr 1fr 80px 100px 24px', borderBottom: '1px solid var(--border)' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0 flex items-start gap-2">
          {isVaultPipeline && (
            <BookOpen size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#a78bfa' }} />
          )}
          <div className="min-w-0">
            <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{job.title}</div>
            <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{job.query}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 items-start">
          {job.sources.map((s) => (
            <span
              key={s}
              className="chip text-[10px] capitalize"
              style={s === 'vault_pipeline'
                ? { background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }
                : { background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}
            >
              {s === 'vault_pipeline' ? 'vault wiki' : s}
            </span>
          ))}
        </div>

        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {absoluteTime(job.created_at)}
        </span>

        <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          {job.ingested_count > 0 ? `${job.ingested_count} item${job.ingested_count !== 1 ? 's' : ''}` : '—'}
        </span>

        <StatusBadge status={job.status} />

        <span className="flex items-center justify-center">
          {expanded ? <ChevronUp size={13} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={13} style={{ color: 'var(--text-tertiary)' }} />}
        </span>
      </div>

      {expanded && (
        <div className="px-4 py-4 space-y-3" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}>
          {job.error && (
            <div className="rounded-md px-3 py-2 text-xs" style={{ background: 'rgba(248,81,73,0.08)', color: '#f85149', border: '1px solid rgba(248,81,73,0.2)' }}>
              {job.error}
            </div>
          )}

          {isVaultPipeline ? (
            <VaultPipelineLog jobId={job.id} status={job.status} />
          ) : (
            resultEntries.length > 0 && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Results preview</div>
                {resultEntries.map(([source, items]) => (
                  <div key={source} className="mb-3">
                    <div className="text-xs font-medium capitalize mb-1" style={{ color: 'var(--text-secondary)' }}>{source} ({items.length})</div>
                    <div className="space-y-1">
                      {(items as Record<string, unknown>[]).slice(0, 3).map((item, i) => {
                        const title = (item.title as string) || (item.text as string) || JSON.stringify(item).slice(0, 80);
                        return (
                          <div key={i} className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>· {title}</div>
                        );
                      })}
                      {items.length > 3 && <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>…and {items.length - 3} more</div>}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); run(); }}
              disabled={running || job.status === 'running'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs hover:bg-white/10 transition-all disabled:opacity-40"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              <Play size={11} /> {running ? 'Starting…' : 'Re-run'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); del(); }}
              disabled={deleting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs hover:bg-white/10 transition-all disabled:opacity-40"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              <Trash2 size={11} /> Delete
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function ResearchPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState<Set<Source>>(new Set(['youtube']));
  const [subreddits, setSubreddits] = useState('');
  const [maxResults, setMaxResults] = useState(10);
  const [vaultId, setVaultId] = useState('');

  const [importVaultId, setImportVaultId] = useState('');
  const [importMsg, setImportMsg] = useState('');

  const hasRunning = (jobs: ResearchJob[]) => jobs.some((j) => j.status === 'running');

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: queryKeys.researchJobs(),
    queryFn: fetchResearchJobs,
    staleTime: 10_000,
    refetchInterval: (query) => {
      const data = query.state.data as ResearchJob[] | undefined;
      return data && hasRunning(data) ? 5_000 : false;
    },
  });

  const { data: sourceStatus } = useQuery({
    queryKey: queryKeys.researchSourceStatus(),
    queryFn: fetchResearchSourceStatus,
    staleTime: 60_000,
  });

  const { data: vaultList = [] } = useQuery({
    queryKey: queryKeys.obsidianVaults(),
    queryFn: fetchVaults,
    staleTime: 60_000,
  });

  const { mutate: doImport, isPending: importing } = useMutation({
    mutationFn: (vaultId: string) => importFromVault(vaultId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.researchJobs() });
      setImportMsg(data.imported === 0
        ? 'No new research files found (all already imported).'
        : `Imported ${data.imported} research file${data.imported !== 1 ? 's' : ''} as completed jobs.`);
      setTimeout(() => setImportMsg(''), 5000);
    },
    onError: () => setImportMsg('Import failed — check vault is registered.'),
  });

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () =>
      createResearchJob({
        title: title.trim(),
        query: query.trim(),
        sources: Array.from(selectedSources),
        subreddits: selectedSources.has('reddit')
          ? subreddits.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        max_results: maxResults,
        vault_id: vaultId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.researchJobs() });
      setShowForm(false);
      setTitle('');
      setQuery('');
      setSelectedSources(new Set(['youtube']));
      setSubreddits('');
      setMaxResults(10);
      setVaultId('');
    },
  });

  function toggleSource(src: Source) {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(src)) {
        next.delete(src);
      } else {
        // vault_pipeline is mutually exclusive with all other sources
        if (src === 'vault_pipeline') return new Set<Source>(['vault_pipeline']);
        next.delete('vault_pipeline');
        next.add(src);
      }
      return next;
    });
  }

  return (
    <div className="p-6 flex flex-col h-full gap-5">
      <div className="flex items-center gap-3 flex-wrap">
        <FlaskConical size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Research Pipeline</h1>
        {jobs.length > 0 && (
          <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
            {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Import from Vault */}
          {vaultList.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={importVaultId}
                onChange={(e) => setImportVaultId(e.target.value)}
                className="px-2 py-1.5 rounded-md text-xs bg-transparent"
                style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', outline: 'none', maxWidth: 160 }}
              >
                <option value="">Select vault…</option>
                {vaultList.map((v: { id: string; name: string }) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <button
                onClick={() => importVaultId && doImport(importVaultId)}
                disabled={!importVaultId || importing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40"
                style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}
                title="Import existing research files from Obsidian vault as completed jobs"
              >
                <Download size={11} />
                {importing ? 'Importing…' : 'Import from Vault'}
              </button>
            </div>
          )}

          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{ background: showForm ? 'rgba(255,255,255,0.06)' : 'var(--accent)', color: showForm ? 'var(--text-secondary)' : '#fff', border: showForm ? '1px solid var(--border)' : undefined }}
          >
            {showForm ? <X size={12} /> : <Plus size={12} />}
            {showForm ? 'Cancel' : 'New Research'}
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="rounded-md px-3 py-2 text-xs" style={{
          background: importMsg.includes('failed') ? 'rgba(248,81,73,0.08)' : 'rgba(167,139,250,0.08)',
          color: importMsg.includes('failed') ? '#f85149' : '#a78bfa',
          border: `1px solid ${importMsg.includes('failed') ? 'rgba(248,81,73,0.2)' : 'rgba(167,139,250,0.2)'}`,
        }}>
          {importMsg}
        </div>
      )}

      {sourceStatus && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sources:</span>
          <SourceChip source="youtube" available={sourceStatus.youtube.available} />
          <SourceChip source="reddit" available={sourceStatus.reddit.available && sourceStatus.reddit.configured} />
          <SourceChip source="web" available={sourceStatus.web.available && sourceStatus.web.configured} />
          {sourceStatus.vault_pipeline && (
            <SourceChip source="vault_pipeline" available={sourceStatus.vault_pipeline.available} />
          )}
        </div>
      )}

      {showForm && (
        <div className="card px-5 py-4 space-y-4" style={{ border: '1px solid var(--border)' }}>
          <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>New Research Job</div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="block">
              <span className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Title</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Research title…" className="w-full px-3 py-2 text-xs rounded-md bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
            </label>
            <label className="block">
              <span className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Research query</span>
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What to research…" className="w-full px-3 py-2 text-xs rounded-md bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
            </label>
          </div>

          <div>
            <span className="text-xs mb-2 block" style={{ color: 'var(--text-secondary)' }}>Sources</span>
            <div className="flex gap-2 flex-wrap items-center">
              {STANDARD_SOURCES.map((src) => (
                <button
                  key={src}
                  onClick={() => toggleSource(src)}
                  disabled={selectedSources.has('vault_pipeline')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs capitalize transition-all disabled:opacity-40"
                  style={{
                    background: selectedSources.has(src) ? 'var(--accent-dim)' : 'rgba(255,255,255,0.04)',
                    color: selectedSources.has(src) ? 'var(--accent)' : 'var(--text-secondary)',
                    border: `1px solid ${selectedSources.has(src) ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {src}
                </button>
              ))}
              <span className="text-xs" style={{ color: 'var(--border)' }}>|</span>
              <button
                onClick={() => toggleSource('vault_pipeline')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all"
                style={{
                  background: selectedSources.has('vault_pipeline') ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                  color: selectedSources.has('vault_pipeline') ? '#a78bfa' : 'var(--text-secondary)',
                  border: `1px solid ${selectedSources.has('vault_pipeline') ? '#a78bfa' : 'var(--border)'}`,
                }}
              >
                <BookOpen size={11} /> Vault Wiki Pipeline
              </button>
            </div>
            {selectedSources.has('vault_pipeline') && (
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
                Reads your CodingVault for context, researches via YouTube + NotebookLM, and writes atomic wiki notes back into <code style={{ fontFamily: 'monospace' }}>wiki/concepts/</code>.
              </p>
            )}
          </div>

          {selectedSources.has('reddit') && (
            <label className="block">
              <span className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Subreddits (comma-separated)</span>
              <input type="text" value={subreddits} onChange={(e) => setSubreddits(e.target.value)} placeholder="programming, MachineLearning" className="w-full px-3 py-2 text-xs rounded-md bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
            </label>
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="block">
              <span className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Max results</span>
              <input type="number" min={1} max={50} value={maxResults} onChange={(e) => setMaxResults(Math.max(1, Number(e.target.value)))} className="w-full px-3 py-2 text-xs rounded-md bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
            </label>
            {vaultList.length > 0 && !selectedSources.has('vault_pipeline') && (
              <label className="block">
                <span className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Save to Obsidian vault (optional)</span>
                <select value={vaultId} onChange={(e) => setVaultId(e.target.value)} className="w-full px-3 py-2 text-xs rounded-md bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', outline: 'none' }}>
                  <option value="">— None —</option>
                  {vaultList.map((v: { id: string; name: string }) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </label>
            )}
          </div>

          <button
            onClick={() => title.trim() && query.trim() && selectedSources.size > 0 && create()}
            disabled={creating || !title.trim() || !query.trim() || selectedSources.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-40 transition-all"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <RefreshCw size={11} />
            {creating ? 'Creating…' : 'Create & Run'}
          </button>
        </div>
      )}

      <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="grid gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider flex-shrink-0" style={{ gridTemplateColumns: 'minmax(0,2fr) 1fr 1fr 80px 100px 24px', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
          <span>Title / Query</span><span>Sources</span><span>Created</span><span>Items</span><span>Status</span><span />
        </div>

        {isLoading && (
          <div className="flex-1 space-y-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-4 w-28" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
          <div className="flex-1 overflow-auto">
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                <FlaskConical size={32} style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No research jobs yet. Create one to get started.</p>
              </div>
            ) : (
              jobs.map((job) => <JobRow key={job.id} job={job} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
