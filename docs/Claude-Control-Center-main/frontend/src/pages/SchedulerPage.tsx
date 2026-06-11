import { useMemo, useState } from 'react';
import {
  CalendarClock, CheckCircle, Clock, Loader2, Moon, Play, Plus, Sun, Trash2, X, XCircle,
} from 'lucide-react';
import { cn, absoluteTime } from '../lib/utils';
import {
  useCreateScheduledTask, useDeleteScheduledTask, useRunScheduledTask,
  useScheduledTasks, useSchedulerActions, useSchedulerRuns, useSchedulerStatus,
  useUpdateScheduledTask,
} from '../hooks/useScheduler';
import type { ScheduledTask, SchedulerAction, SchedulerRun } from '../api/scheduler';

const CRON_PRESETS: { label: string; cron: string }[] = [
  { label: 'Hourly', cron: '0 * * * *' },
  { label: 'Daily 3am', cron: '0 3 * * *' },
  { label: 'Weekdays 8am', cron: '0 8 * * 1-5' },
  { label: 'Weekly Mon 9am', cron: '0 9 * * 1' },
];

function StatusIcon({ status }: { status: SchedulerRun['status'] }) {
  if (status === 'success') return <CheckCircle size={13} style={{ color: 'var(--success)' }} />;
  if (status === 'error') return <XCircle size={13} style={{ color: '#f85149' }} />;
  return <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent)' }} />;
}

function CreateTaskForm({ actions, onClose }: { actions: SchedulerAction[]; onClose: () => void }) {
  const create = useCreateScheduledTask();
  const [name, setName] = useState('');
  const [action, setAction] = useState(actions[0]?.id ?? '');
  const [cron, setCron] = useState('0 3 * * *');
  const [quietGuard, setQuietGuard] = useState(true);
  const [paramsText, setParamsText] = useState('{}');
  const [error, setError] = useState<string | null>(null);

  const selected = actions.find((a) => a.id === action);

  const submit = () => {
    let params: Record<string, unknown>;
    try {
      params = JSON.parse(paramsText || '{}');
    } catch {
      setError('Params must be valid JSON');
      return;
    }
    create.mutate(
      { name, action, cron, params, quiet_guard: quietGuard, enabled: true },
      {
        onSuccess: () => onClose(),
        onError: (e) => setError(e instanceof Error ? e.message : 'Failed to create task'),
      },
    );
  };

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">New scheduled task</h3>
        <button className="btn-secondary p-1" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Name
          <input
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={selected?.name ?? 'Task name'}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Action
          <select className="input-field" value={action} onChange={(e) => setAction(e.target.value)}>
            {actions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
      </div>

      {selected && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{selected.description}</p>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Cron schedule
          <input
            className="input-field font-mono mt-1 w-full"
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            placeholder="0 3 * * *"
          />
        </label>
        <div className="flex gap-2 flex-wrap">
          {CRON_PRESETS.map((p) => (
            <button
              key={p.cron}
              className={cn('chip', cron === p.cron && 'ring-1')}
              onClick={() => setCron(p.cron)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {selected && Object.keys(selected.params).length > 0 && (
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Params (JSON)
          <textarea
            className="input-field font-mono"
            rows={2}
            value={paramsText}
            onChange={(e) => setParamsText(e.target.value)}
          />
          <span style={{ color: 'var(--text-tertiary)' }}>
            {Object.entries(selected.params).map(([k, v]) => `${k}: ${v}`).join(' · ')}
          </span>
        </label>
      )}

      <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <input type="checkbox" checked={quietGuard} onChange={(e) => setQuietGuard(e.target.checked)} />
        Quiet-window guard — defer this run while recent GWS activity indicates you're working
      </label>

      {error && <p className="text-xs" style={{ color: '#f85149' }}>{error}</p>}

      <div className="flex justify-end gap-2">
        <button className="btn-secondary text-xs" onClick={onClose}>Cancel</button>
        <button
          className="btn-primary text-xs"
          onClick={submit}
          disabled={create.isPending || !action || !cron.trim()}
        >
          {create.isPending ? 'Creating…' : 'Create task'}
        </button>
      </div>
    </div>
  );
}

function TaskCard({ task, actionName }: { task: ScheduledTask; actionName: string }) {
  const update = useUpdateScheduledTask();
  const del = useDeleteScheduledTask();
  const run = useRunScheduledTask();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={cn('card p-4 flex flex-col gap-2', !task.enabled && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{task.name}</span>
            <span className="chip">{actionName}</span>
            {task.quiet_guard && (
              <span className="chip flex items-center gap-1" title="Deferred while GWS activity is recent">
                <Moon size={11} /> quiet guard
              </span>
            )}
            {task.deferred_since && (
              <span className="chip" style={{ color: '#d29922' }}>deferred</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
            <span className="flex items-center gap-1"><CalendarClock size={12} />{task.cron}</span>
            {task.next_run_at && task.enabled && (
              <span className="flex items-center gap-1">
                <Clock size={12} /> next {absoluteTime(task.next_run_at)}
              </span>
            )}
            {task.last_run_at && (
              <span>
                last {absoluteTime(task.last_run_at)}
                {task.last_status ? ` (${task.last_status})` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="btn-secondary p-1.5"
            title="Run now (bypasses quiet guard)"
            onClick={() => run.mutate(task.id)}
            disabled={run.isPending}
          >
            {run.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          </button>
          <button
            className="btn-secondary p-1.5 text-xs"
            title={task.enabled ? 'Disable' : 'Enable'}
            onClick={() => update.mutate({ id: task.id, patch: { enabled: !task.enabled } })}
          >
            {task.enabled ? 'Disable' : 'Enable'}
          </button>
          {confirmDelete ? (
            <>
              <button
                className="btn-secondary p-1.5 text-xs"
                style={{ color: '#f85149' }}
                onClick={() => del.mutate(task.id)}
              >
                Confirm
              </button>
              <button className="btn-secondary p-1.5 text-xs" onClick={() => setConfirmDelete(false)}>
                <X size={14} />
              </button>
            </>
          ) : (
            <button className="btn-secondary p-1.5" title="Delete task" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {task.description && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{task.description}</p>
      )}
    </div>
  );
}

function RunRow({ run }: { run: SchedulerRun }) {
  const [open, setOpen] = useState(false);
  const summary = run.error ?? (run.result ? JSON.stringify(run.result) : '');
  return (
    <div className="card px-3 py-2">
      <button className="w-full flex items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
        <StatusIcon status={run.status} />
        <span className="text-xs font-medium truncate">{run.task_name || run.action}</span>
        <span className="chip">{run.trigger}</span>
        <span className="text-xs font-mono ml-auto shrink-0" style={{ color: 'var(--text-tertiary)' }}>
          {absoluteTime(run.started_at)}
          {run.duration_ms != null && ` · ${run.duration_ms} ms`}
        </span>
      </button>
      {open && summary && (
        <pre
          className="text-xs font-mono mt-2 p-2 overflow-x-auto whitespace-pre-wrap break-all"
          style={{ background: 'var(--bg-tertiary)', color: run.error ? '#f85149' : 'var(--text-secondary)' }}
        >
          {summary}
        </pre>
      )}
    </div>
  );
}

export function SchedulerPage() {
  const { data: statusData } = useSchedulerStatus();
  const { data: actionsData } = useSchedulerActions();
  const { data: tasksData, isLoading: tasksLoading, isError: tasksError } = useScheduledTasks();
  const { data: runsData } = useSchedulerRuns();
  const [showCreate, setShowCreate] = useState(false);

  const actions = actionsData?.actions ?? [];
  const tasks = tasksData?.tasks ?? [];
  const runs = runsData?.runs ?? [];
  const actionNames = useMemo(
    () => Object.fromEntries(actions.map((a) => [a.id, a.name])),
    [actions],
  );

  return (
    <div className="p-6 flex flex-col gap-4 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <CalendarClock size={18} /> Scheduler
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            In-app cron scheduler running built-in maintenance actions — works inside Docker, no crontab.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statusData && (
            <>
              <span
                className="chip flex items-center gap-1"
                style={{ color: statusData.running ? 'var(--success)' : '#f85149' }}
              >
                {statusData.running ? 'running' : 'stopped'}
              </span>
              <span className="chip flex items-center gap-1" title={`Quiet window: ${statusData.quiet_window_minutes} min without GWS activity`}>
                {statusData.quiet ? <Moon size={11} /> : <Sun size={11} />}
                {statusData.quiet ? 'quiet' : 'active'}
              </span>
            </>
          )}
          <button className="btn-primary text-xs flex items-center gap-1" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New task
          </button>
        </div>
      </div>

      {showCreate && actions.length > 0 && (
        <CreateTaskForm actions={actions} onClose={() => setShowCreate(false)} />
      )}

      {tasksLoading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          <Loader2 size={14} className="animate-spin" /> Loading tasks…
        </div>
      )}
      {tasksError && (
        <p className="text-sm" style={{ color: '#f85149' }}>Failed to load scheduled tasks.</p>
      )}
      {!tasksLoading && !tasksError && tasks.length === 0 && !showCreate && (
        <div className="card p-6 text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No scheduled tasks yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Create one to run maintenance automatically — memory consolidation, session tidy, client digest, eval backfill.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} actionName={actionNames[t.action] ?? t.action} />
        ))}
      </div>

      {runs.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wider mt-2" style={{ color: 'var(--text-tertiary)' }}>
            Run history
          </h2>
          {runs.map((r) => (
            <RunRow key={r.id} run={r} />
          ))}
        </div>
      )}
    </div>
  );
}
