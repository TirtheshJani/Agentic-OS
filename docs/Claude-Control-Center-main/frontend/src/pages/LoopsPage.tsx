import { useState } from 'react';
import {
  RefreshCcw, Plus, Play, Trash2, Clock, CalendarClock, CheckCircle, XCircle,
  Loader2, TrendingUp, TrendingDown, Minus, Terminal, Bot, X, AlarmClock, AlarmClockOff,
} from 'lucide-react';
import { cn, absoluteTime } from '../lib/utils';
import {
  useLoops, useLoop, useLoopRuns, useCreateLoop, useDeleteLoop,
  useTriggerLoopRun, useInstallLoopCron, useRemoveLoopCron, useDiscoveredCron,
} from '../hooks/useLoops';
import type { Loop, LoopRun, LoopStats, LoopInput, GradePoint } from '../api/loops';

const GRADE_COLORS: Record<string, string> = {
  A: 'var(--success)', B: '#3fb950', C: '#d29922', D: '#db6d28', F: '#f85149',
};

function gradeColor(grade: string | null): string {
  if (!grade) return 'var(--text-tertiary)';
  return GRADE_COLORS[grade[0]] ?? 'var(--text-tertiary)';
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number | null; sub?: string; color?: string }) {
  return (
    <div className="card px-4 py-3 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="text-2xl font-semibold" style={{ color: color ?? 'var(--text-primary)' }}>{value ?? '—'}</span>
      {sub && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</span>}
    </div>
  );
}

function StatusIcon({ status }: { status: LoopRun['status'] }) {
  if (status === 'success') return <CheckCircle size={13} style={{ color: 'var(--success)' }} />;
  if (status === 'error') return <XCircle size={13} style={{ color: '#f85149' }} />;
  return <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent)' }} />;
}

/** Inline grade-trend sparkline (composite score over runs, 0–100). */
function GradeTrend({ points }: { points: GradePoint[] }) {
  const scored = points.filter((p) => p.composite_score != null);
  if (scored.length === 0) {
    return (
      <div className="card px-4 py-3">
        <div className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          Quality trend
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          No graded runs yet. Runs are graded by the Evals system once their session is captured.
        </p>
      </div>
    );
  }
  const W = 100, H = 40;
  const xs = scored.map((_, i) => (scored.length === 1 ? 0 : (i / (scored.length - 1)) * W));
  const ys = scored.map((p) => H - ((p.composite_score ?? 0) / 100) * H);
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
        Quality trend ({scored.length} graded)
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 60 }}>
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {xs.map((x, i) => (
          <circle key={scored[i].run_id} cx={x} cy={ys[i]} r={1.8} fill={gradeColor(scored[i].grade)} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-xs font-mono" style={{ color: gradeColor(scored[0].grade) }}>
          {scored[0].composite_score} ({scored[0].grade})
        </span>
        <span className="text-xs font-mono" style={{ color: gradeColor(scored[scored.length - 1].grade) }}>
          {scored[scored.length - 1].composite_score} ({scored[scored.length - 1].grade})
        </span>
      </div>
    </div>
  );
}

function ImprovementBadge({ value }: { value: number | null }) {
  if (value == null) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  const color = value > 0 ? 'var(--success)' : value < 0 ? '#f85149' : 'var(--text-tertiary)';
  return (
    <span className="flex items-center gap-1" style={{ color }}>
      <Icon size={16} />{value > 0 ? '+' : ''}{value}
    </span>
  );
}

const EMPTY_FORM: LoopInput = {
  name: '', kind: 'claude', prompt: '', command: '', cwd: '',
  schedule_cron: '', schedule_human: '', description: '', enabled: true,
};

function CreateLoopModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<LoopInput>(EMPTY_FORM);
  const create = useCreateLoop();
  const set = (k: keyof LoopInput, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    create.mutate(form, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="card w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New loop</h2>
          <button onClick={onClose}><X size={16} style={{ color: 'var(--text-tertiary)' }} /></button>
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Name</span>
          <input className="input-field w-full mt-1" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Weekly CC features research" />
        </label>

        <div className="flex gap-2">
          {(['claude', 'shell'] as const).map((k) => (
            <button key={k} onClick={() => set('kind', k)}
              className={cn('flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all', form.kind === k ? 'bg-white/10' : 'hover:bg-white/5')}
              style={{ color: form.kind === k ? 'var(--accent)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              {k === 'claude' ? <Bot size={13} /> : <Terminal size={13} />}{k}
            </button>
          ))}
        </div>

        {form.kind === 'claude' ? (
          <label className="block">
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Prompt</span>
            <textarea className="input-field w-full mt-1 font-mono text-xs" rows={4} value={form.prompt} onChange={(e) => set('prompt', e.target.value)} placeholder="Run the youtube-research-pipeline skill to summarize…" />
          </label>
        ) : (
          <label className="block">
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Command</span>
            <textarea className="input-field w-full mt-1 font-mono text-xs" rows={3} value={form.command} onChange={(e) => set('command', e.target.value)} placeholder="curl -s http://localhost:5050/…" />
          </label>
        )}

        <label className="block">
          <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Working directory</span>
          <input className="input-field w-full mt-1 font-mono text-xs" value={form.cwd} onChange={(e) => set('cwd', e.target.value)} placeholder="/home/ruwzeta/Documents/Code/…" />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Cron schedule</span>
            <input className="input-field w-full mt-1 font-mono text-xs" value={form.schedule_cron} onChange={(e) => set('schedule_cron', e.target.value)} placeholder="0 0 * * 1" />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Human label</span>
            <input className="input-field w-full mt-1 text-xs" value={form.schedule_human} onChange={(e) => set('schedule_human', e.target.value)} placeholder="Mon 00:00" />
          </label>
        </div>

        {create.isError && <p className="text-xs" style={{ color: '#f85149' }}>{String((create.error as Error)?.message ?? 'Failed to create loop')}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 rounded-md text-xs" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancel</button>
          <button onClick={submit} disabled={create.isPending || !form.name.trim()} className="btn-primary px-3 py-1.5 rounded-md text-xs disabled:opacity-50">
            {create.isPending ? 'Creating…' : 'Create loop'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoopDetail({ loopId }: { loopId: string }) {
  const { data: loop } = useLoop(loopId);
  const { data: runsData } = useLoopRuns(loopId);
  const trigger = useTriggerLoopRun();
  const install = useInstallLoopCron();
  const remove = useRemoveLoopCron();
  const del = useDeleteLoop();

  if (!loop) return <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>;

  const stats: LoopStats | undefined = loop.stats;
  const runs = runsData?.runs ?? [];

  return (
    <div className="flex-1 overflow-auto p-5 space-y-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            {loop.kind === 'claude' ? <Bot size={16} /> : <Terminal size={16} />}{loop.name}
          </h2>
          {loop.description && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{loop.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <span className="flex items-center gap-1"><CalendarClock size={12} />{loop.schedule_human || loop.schedule_cron || 'no schedule'}</span>
            {loop.schedule_cron && <code className="font-mono">{loop.schedule_cron}</code>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => trigger.mutate(loopId)} disabled={trigger.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-white/10 disabled:opacity-50" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            <Play size={12} />{trigger.isPending ? 'Triggering…' : 'Run now'}
          </button>
          {loop.schedule_cron && (loop.cron_installed ? (
            <button onClick={() => remove.mutate(loopId)} disabled={remove.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-white/10 disabled:opacity-50" style={{ color: '#f85149', border: '1px solid var(--border)' }}>
              <AlarmClockOff size={12} />Uninstall cron
            </button>
          ) : (
            <button onClick={() => install.mutate(loopId)} disabled={install.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-white/10 disabled:opacity-50" style={{ color: 'var(--accent)', border: '1px solid var(--border)' }}>
              <AlarmClock size={12} />Install cron
            </button>
          ))}
          <button onClick={() => { if (confirm('Delete this loop and its run history?')) del.mutate(loopId); }}
            className="p-1.5 rounded-md hover:bg-white/10" style={{ border: '1px solid var(--border)' }}>
            <Trash2 size={13} style={{ color: '#f85149' }} />
          </button>
        </div>
      </div>

      {loop.cron_installed && (
        <div className="text-xs flex items-center gap-2" style={{ color: 'var(--success)' }}>
          <CheckCircle size={12} /> Cron installed — fires automatically per schedule.
        </div>
      )}
      {loop.cron_line && (
        <pre className="text-xs font-mono whitespace-pre-wrap break-all rounded p-3" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-tertiary)', border: '1px solid var(--border)' }}>
          {loop.cron_line}
        </pre>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total runs" value={stats?.total_runs ?? 0} />
        <StatCard label="Success rate" value={stats?.success_rate != null ? `${stats.success_rate}%` : null} />
        <StatCard label="Avg score" value={stats?.avg_score ?? null} sub={stats?.graded_runs ? `${stats.graded_runs} graded` : undefined} />
        <div className="card px-4 py-3 flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Improvement</span>
          <span className="text-2xl font-semibold"><ImprovementBadge value={stats?.improvement ?? null} /></span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>first → latest score</span>
        </div>
      </div>

      {stats && <GradeTrend points={stats.grade_trend} />}

      <div className="card overflow-hidden">
        <div className="grid gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider"
          style={{ gridTemplateColumns: '1.2fr 90px 80px 90px 1fr', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
          <span>Started</span><span>Trigger</span><span>Duration</span><span>Status</span><span>Session</span>
        </div>
        {runs.length === 0 ? (
          <div className="py-10 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>No runs yet. Hit “Run now” to test.</div>
        ) : runs.map((r) => (
          <div key={r.run_id} className="grid gap-3 px-4 py-2.5 text-xs" style={{ gridTemplateColumns: '1.2fr 90px 80px 90px 1fr', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <span>{absoluteTime(r.started_at)}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>{r.trigger}</span>
            <span className="flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
              {r.duration_s != null ? <><Clock size={10} />{r.duration_s}s</> : '—'}
            </span>
            <span className="flex items-center gap-1.5"><StatusIcon status={r.status} />{r.status}</span>
            <span className="font-mono truncate" style={{ color: 'var(--text-tertiary)' }} title={r.session_id ?? ''}>{r.session_id ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoopListItem({ loop, active, onClick }: { loop: Loop; active: boolean; onClick: () => void }) {
  const s = loop.stats;
  return (
    <button onClick={onClick}
      className={cn('w-full text-left px-3 py-3 transition-colors', active ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]')}
      style={{ borderBottom: '1px solid var(--border)', borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent' }}>
      <div className="flex items-center gap-2 min-w-0">
        {loop.kind === 'claude' ? <Bot size={13} style={{ color: 'var(--accent)' }} /> : <Terminal size={13} style={{ color: 'var(--accent)' }} />}
        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{loop.name}</span>
        {!loop.enabled && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>(off)</span>}
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        <span>{s?.total_runs ?? 0} runs</span>
        {s?.success_rate != null && <span>{s.success_rate}% ok</span>}
        {s?.avg_score != null && <span style={{ color: gradeColor(s.grade_trend.length ? s.grade_trend[s.grade_trend.length - 1].grade : null) }}>score {s.avg_score}</span>}
        {loop.cron_installed && <AlarmClock size={11} style={{ color: 'var(--success)' }} />}
      </div>
    </button>
  );
}

/** External (non-CCC) crontab entries detected on this machine. */
function DiscoveredCronPanel() {
  const { data } = useDiscoveredCron();
  if (!data) return null;
  if (!data.available) {
    return (
      <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--border)' }}>
        Crontab not accessible from here (e.g. running in Docker) and no host snapshot yet. Run{' '}
        <code className="font-mono">python -m scripts.cron_reporter --install</code> from the backend dir on the host
        to report it every 15 min.
      </div>
    );
  }
  const external = data.entries.filter((e) => !e.managed);
  if (external.length === 0) return null;
  return (
    <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
        Detected cron jobs ({external.length})
      </div>
      <div className="flex flex-col gap-2">
        {external.map((e, i) => (
          <div key={`${e.schedule}-${i}`} className="text-xs">
            <div className="font-mono" style={{ color: 'var(--text-secondary)' }}>{e.schedule}</div>
            <div className="font-mono truncate" title={e.command} style={{ color: 'var(--text-tertiary)' }}>
              {e.command}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
        Found in your user crontab but not managed by CCC.
        {data.source === 'host-report' && data.reported_at && (
          <> Snapshot reported {absoluteTime(data.reported_at)}.</>
        )}
      </p>
    </div>
  );
}

export function LoopsPage() {
  const { data, isLoading } = useLoops();
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loops = data?.loops ?? [];
  const activeId = selected ?? loops[0]?.id ?? null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <RefreshCcw size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Loops</h1>
        {loops.length > 0 && (
          <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
            {loops.length} loop{loops.length !== 1 ? 's' : ''}
          </span>
        )}
        <button onClick={() => setShowCreate(true)}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium btn-primary">
          <Plus size={13} />New loop
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-72 flex-shrink-0 overflow-auto" style={{ borderRight: '1px solid var(--border)' }}>
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}</div>
          ) : loops.length === 0 ? (
            <div className="p-6 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
              No loops yet. Create one to schedule recurring Claude tasks and track their quality over time.
            </div>
          ) : loops.map((l) => (
            <LoopListItem key={l.id} loop={l} active={l.id === activeId} onClick={() => setSelected(l.id)} />
          ))}
          <DiscoveredCronPanel />
        </div>

        {activeId ? <LoopDetail loopId={activeId} /> : (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Select a loop, or create one.
          </div>
        )}
      </div>

      {showCreate && <CreateLoopModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
