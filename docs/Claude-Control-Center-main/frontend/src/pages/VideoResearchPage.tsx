import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Film, Plus, Trash2, Play, ChevronDown, ChevronUp, Sparkles, BookOpen, RefreshCw,
} from 'lucide-react';
import {
  useVideoJobs,
  useVideoJob,
  useCreateVideoJob,
  useRunVideoJob,
  useDeleteVideoJob,
  usePickAngle,
  useSyncVideoToVault,
  useVideoDeliverable,
  useVideoSourcesStatus,
} from '../hooks/useVideoResearch';
import type {
  VideoAngle, VideoFormat, VideoJobStatus, VideoMode, VideoResearchJob,
} from '../api/videoResearch';
import { fetchVaults } from '../api/obsidian';
import { absoluteTime, cn } from '../lib/utils';

const DELIVERABLES = [
  { name: 'script.md', label: 'Script' },
  { name: 'storyboard.md', label: 'Storyboard' },
  { name: 'titles.json', label: 'Titles & Thumbnails' },
  { name: 'thumbnail_concepts.md', label: 'Thumbnails' },
  { name: 'show_notes.md', label: 'Show Notes' },
  { name: 'research_summary.md', label: 'Research' },
] as const;

const STATUS_COLOR: Record<VideoJobStatus, { bg: string; color: string; label: string }> = {
  pending:        { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-tertiary)', label: 'Pending' },
  running:        { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24',              label: 'Running' },
  awaiting_pick:  { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa',              label: 'Pick angle' },
  done:           { bg: 'rgba(34,197,94,0.12)',   color: '#4ade80',              label: 'Done' },
  failed:         { bg: 'rgba(248,81,73,0.12)',   color: '#f85149',              label: 'Failed' },
};

function StatusBadge({ status }: { status: VideoJobStatus }) {
  const cfg = STATUS_COLOR[status];
  return (
    <span
      className={cn('chip text-xs', status === 'running' && 'animate-pulse')}
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function PhaseBadge({ phase }: { phase: VideoResearchJob['phase'] }) {
  return (
    <span className="chip text-xs capitalize" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}>
      {phase}
    </span>
  );
}

function CreateForm({ onClose }: { onClose: () => void }) {
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<VideoMode>('single-video');
  const [format, setFormat] = useState<VideoFormat>('long');
  const [vaultId, setVaultId] = useState<string>('');
  const { data: vaults = [] } = useQuery({ queryKey: ['obsidian-vaults'], queryFn: fetchVaults });
  const create = useCreateVideoJob();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    await create.mutateAsync({
      topic: topic.trim(),
      mode,
      format,
      vault_id: vaultId || null,
    });
    onClose();
  };

  return (
    <form onSubmit={submit} className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Film size={16} />
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>New video research</h3>
      </div>
      <input
        className="input-field"
        placeholder="Topic (e.g. 'how transformer attention actually works')"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        autoFocus
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Mode</span>
          <select className="input-field" value={mode} onChange={(e) => setMode(e.target.value as VideoMode)}>
            <option value="single-video">Single video</option>
            <option value="topic-exploration">Topic exploration</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Format</span>
          <select className="input-field" value={format} onChange={(e) => setFormat(e.target.value as VideoFormat)}>
            <option value="long">Long-form (10–20 min)</option>
            <option value="short">Short (&lt; 60s)</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Vault (optional)</span>
          <select className="input-field" value={vaultId} onChange={(e) => setVaultId(e.target.value)}>
            <option value="">— none —</option>
            {vaults.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={!topic.trim() || create.isPending}>
          {create.isPending ? 'Creating…' : 'Create & run'}
        </button>
      </div>
      {create.error && (
        <div style={{ color: '#f85149', fontSize: 12 }}>{(create.error as Error).message}</div>
      )}
    </form>
  );
}

function JobLog({ log, status }: { log: string; status: VideoJobStatus }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);
  if (!log) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
        Pipeline log {status === 'running' && <span className="animate-pulse">·</span>}
      </div>
      <pre
        ref={ref}
        className="rounded p-3 text-[11px] leading-relaxed overflow-auto"
        style={{
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid var(--border-subtle)',
          maxHeight: 260,
          whiteSpace: 'pre-wrap',
          fontFamily: 'var(--font-mono-ds)',
          color: 'var(--text-secondary)',
        }}
      >
        {log}
      </pre>
    </div>
  );
}

function AnglesPicker({ job }: { job: VideoResearchJob }) {
  const { data } = useVideoDeliverable(job.id, 'angles.json');
  const pick = usePickAngle();
  const angles: VideoAngle[] = useMemo(() => {
    if (!data?.content) return [];
    try {
      const parsed = JSON.parse(data.content);
      return parsed.angles ?? [];
    } catch {
      return [];
    }
  }, [data?.content]);

  if (!angles.length) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        Waiting for angles.json…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
        Pick an angle to script
      </div>
      {angles.map((angle, idx) => (
        <div
          key={idx}
          className="card"
          style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{angle.title}</div>
            <button
              className="btn-primary text-xs"
              disabled={pick.isPending}
              onClick={() => pick.mutate({ jobId: job.id, angleIndex: idx })}
            >
              {pick.isPending ? '…' : 'Pick'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{angle.hook}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>For: {angle.audience} · {angle.format_hint ?? 'long'}</div>
          {angle.key_points?.length > 0 && (
            <ul style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 16, listStyle: 'disc' }}>
              {angle.key_points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function DeliverableTab({ jobId, name }: { jobId: string; name: string }) {
  const { data, isLoading, error } = useVideoDeliverable(jobId, name);
  if (isLoading) return <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Loading…</div>;
  if (error) return <div style={{ fontSize: 12, color: '#f85149' }}>{(error as Error).message}</div>;
  if (!data) return null;

  if (name.endsWith('.json')) {
    return (
      <pre
        className="rounded p-3 text-[12px] overflow-auto"
        style={{
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid var(--border-subtle)',
          maxHeight: 480,
          fontFamily: 'var(--font-mono-ds)',
          color: 'var(--text-secondary)',
        }}
      >
        {data.content}
      </pre>
    );
  }

  return (
    <div
      className="markdown-content"
      style={{
        background: 'rgba(0,0,0,0.18)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 4,
        padding: 16,
        maxHeight: 540,
        overflow: 'auto',
        fontSize: 13,
        lineHeight: 1.6,
        color: 'var(--text-secondary)',
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.content}</ReactMarkdown>
    </div>
  );
}

function JobDetail({ job }: { job: VideoResearchJob }) {
  const [tab, setTab] = useState<string>('script.md');
  const sync = useSyncVideoToVault();
  const { data: full } = useVideoJob(job.id);
  const merged = full ?? job;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <StatusBadge status={merged.status} />
        <PhaseBadge phase={merged.phase} />
        <span className="chip text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}>
          {merged.mode} · {merged.format}
        </span>
        {merged.vault_id && (
          <span className="chip text-xs" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
            vault sync ready
          </span>
        )}
        {merged.vault_mirror_path && (
          <span className="chip text-xs" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
            mirrored → {merged.vault_mirror_path}
          </span>
        )}
      </div>

      {merged.error && (
        <div className="card" style={{ padding: 10, background: 'rgba(248,81,73,0.08)', color: '#f85149', fontSize: 12 }}>
          {merged.error}
        </div>
      )}

      {merged.status === 'awaiting_pick' && <AnglesPicker job={merged} />}

      {merged.status === 'done' && merged.mode === 'single-video' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {DELIVERABLES.map((d) => (
              <button
                key={d.name}
                className={cn('chip text-xs', tab === d.name && 'active')}
                style={{
                  background: tab === d.name ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.05)',
                  color: tab === d.name ? '#c4b5fd' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  border: tab === d.name ? '1px solid rgba(167,139,250,0.4)' : '1px solid transparent',
                }}
                onClick={() => setTab(d.name)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <DeliverableTab jobId={merged.id} name={tab} />
        </div>
      )}

      <JobLog log={merged.log ?? ''} status={merged.status} />

      <div style={{ display: 'flex', gap: 8 }}>
        {merged.vault_id && merged.status === 'done' && (
          <button
            className="btn text-xs"
            disabled={sync.isPending}
            onClick={() => sync.mutate({ jobId: merged.id })}
          >
            <BookOpen size={12} /> {sync.isPending ? 'Syncing…' : 'Sync to vault'}
          </button>
        )}
      </div>
    </div>
  );
}

function JobRow({ job, expanded, onToggle }: { job: VideoResearchJob; expanded: boolean; onToggle: () => void }) {
  const run = useRunVideoJob();
  const del = useDeleteVideoJob();

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <Film size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {job.topic}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {absoluteTime(job.created_at)} · {job.format} · {job.mode}
          </div>
        </div>
        <StatusBadge status={job.status} />
        <PhaseBadge phase={job.phase} />
        <button
          className="icon-btn"
          title="Re-run / resume"
          onClick={(e) => { e.stopPropagation(); run.mutate(job.id); }}
          disabled={job.status === 'running' || run.isPending}
        >
          <Play size={13} />
        </button>
        <button
          className="icon-btn"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete "${job.topic}"? This removes the deliverables folder.`)) {
              del.mutate(job.id);
            }
          }}
        >
          <Trash2 size={13} />
        </button>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
      {expanded && <JobDetail job={job} />}
    </div>
  );
}

export function VideoResearchPage() {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: jobs = [], isLoading, refetch } = useVideoJobs();
  const { data: sources } = useVideoSourcesStatus();

  const claudeReady = sources?.claude_cli?.available ?? false;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Film size={20} /> Video Research
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Research a topic with YouTube + NotebookLM + Firecrawl + your vault, then auto-generate scripts, storyboards, titles, and show notes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn text-xs" onClick={() => refetch()} title="Refresh">
            <RefreshCw size={12} />
          </button>
          <button className="btn-primary text-xs" onClick={() => setShowForm((s) => !s)}>
            <Plus size={12} /> New
          </button>
        </div>
      </div>

      {!claudeReady && (
        <div className="card" style={{ padding: 10, marginBottom: 12, background: 'rgba(248,81,73,0.08)', color: '#f85149', fontSize: 12 }}>
          <Sparkles size={12} style={{ display: 'inline', marginRight: 6 }} />
          Claude CLI not found — the pipeline shells out to <code>claude --dangerously-skip-permissions</code> to run the vault-research-pipeline skill.
          Install Claude Code first.
        </div>
      )}

      {showForm && <CreateForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          No video research jobs yet. Click <strong>New</strong> to start one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {jobs.map((j) => (
            <JobRow
              key={j.id}
              job={j}
              expanded={expandedId === j.id}
              onToggle={() => setExpandedId((cur) => (cur === j.id ? null : j.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
