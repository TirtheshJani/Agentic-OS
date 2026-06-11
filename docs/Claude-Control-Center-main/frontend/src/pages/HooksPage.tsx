import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { Zap, Plus, Trash2, Pencil, X, ArrowUpCircle, LayoutGrid, Activity } from 'lucide-react';
import { fetchHooks, createHook, updateHook, deleteHook, promoteHook, fetchCodexHooks } from '../api/hooks';
import { useProjects } from '../hooks/useProjects';
import { GwsHookTemplates } from '../components/gws/GwsHookTemplates';
import { apiFetch } from '../api/client';
import { relativeTime } from '../lib/utils';
import type { HookEntry, HookEvent } from '../types';

const SCOPE_GLOBAL = '__global__';
const EVENTS: HookEvent[] = ['PreToolUse', 'PostToolUse', 'Stop', 'Notification'];
type View = 'hooks' | 'gws';
type Engine = 'claude' | 'codex';

interface FormState {
  event: HookEvent;
  matcher: string;
  command: string;
}

const emptyForm = (): FormState => ({ event: 'PreToolUse', matcher: '*', command: '' });

export function HooksPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>('hooks');
  const [engine, setEngine] = useState<Engine>('claude');
  const [scope, setScope] = useState(SCOPE_GLOBAL);
  const [activeTab, setActiveTab] = useState<HookEvent>('PreToolUse');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<HookEvent | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [err, setErr] = useState('');

  const projectId = scope === SCOPE_GLOBAL ? undefined : scope;
  const { data: projects } = useProjects();
  const { data: hooksData, isLoading } = useQuery({
    queryKey: queryKeys.hooks(scope),
    queryFn: () => fetchHooks(projectId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.hooks() });

  const createMut = useMutation({
    mutationFn: (f: FormState) => createHook(f.event, { matcher: f.matcher, command: f.command, projectId }),
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (e: Error) => setErr(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ event, index, f }: { event: HookEvent; index: number; f: FormState }) =>
      updateHook(event, index, { matcher: f.matcher, command: f.command }, projectId),
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (e: Error) => setErr(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: ({ event, index }: { event: HookEvent; index: number }) =>
      deleteHook(event, index, projectId),
    onSuccess: invalidate,
  });

  const promoteMut = useMutation({
    mutationFn: ({ event, index }: { event: HookEvent; index: number }) =>
      promoteHook(event, index, projectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.hooks(SCOPE_GLOBAL) }),
  });

  function openCreate(event: HookEvent) {
    setEditingIndex(null);
    setEditingEvent(null);
    setForm({ ...emptyForm(), event });
    setErr('');
    setModalOpen(true);
  }

  function openEdit(event: HookEvent, index: number, entry: HookEntry) {
    setEditingIndex(index);
    setEditingEvent(event);
    setForm({
      event,
      matcher: entry.matcher,
      command: entry.hooks[0]?.command ?? '',
    });
    setErr('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingIndex(null);
    setEditingEvent(null);
  }

  function handleSave() {
    setErr('');
    if (!form.command.trim()) { setErr('Command is required'); return; }
    if (editingEvent !== null && editingIndex !== null) {
      updateMut.mutate({ event: editingEvent, index: editingIndex, f: form });
    } else {
      createMut.mutate(form);
    }
  }

  const saving = createMut.isPending || updateMut.isPending;

  const { mutate: installPlanTracker, isPending: installingTracker, isSuccess: trackerInstalled, isError: trackerError } = useMutation({
    mutationFn: () => apiFetch('/api/hooks/install-plan-tracker', { method: 'POST' }),
  });

  const { data: codexHooksData, isLoading: codexHooksLoading } = useQuery({
    queryKey: queryKeys.codexHooks(),
    queryFn: fetchCodexHooks,
    enabled: view === 'hooks' && engine === 'codex',
  });

  return (
    <div className="p-6">
      <div className="mb-6 card px-4 py-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Activity size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Plan Tracker Hook
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Installs a PostToolUse hook that automatically tracks plan progress from Claude Code sessions.
            </p>
            {trackerError && (
              <p className="text-xs mt-1" style={{ color: 'var(--error)' }}>Installation failed.</p>
            )}
            {trackerInstalled && (
              <p className="text-xs mt-1" style={{ color: '#4ade80' }}>Plan tracker hook installed successfully.</p>
            )}
          </div>
        </div>
        <button
          onClick={() => installPlanTracker()}
          disabled={installingTracker || trackerInstalled}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
          style={{ background: trackerInstalled ? 'rgba(34,197,94,0.15)' : 'var(--accent)', color: trackerInstalled ? '#4ade80' : '#fff' }}
        >
          {installingTracker ? 'Installing…' : trackerInstalled ? 'Installed' : 'Install Plan Tracker'}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Zap size={18} style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Hooks</h1>
        </div>
        {/* View toggle */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setView('hooks')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={view === 'hooks'
              ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
              : { color: 'var(--text-secondary)' }}
          >
            <Zap size={11} /> Hooks
          </button>
          <button
            onClick={() => setView('gws')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={view === 'gws'
              ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
              : { color: 'var(--text-secondary)' }}
          >
            <LayoutGrid size={11} /> GWS Automations
          </button>
        </div>
      </div>

      {/* GWS Automations view */}
      {view === 'gws' && (
        <GwsHookTemplates />
      )}

      {/* Regular hooks view */}
      {view === 'hooks' && <>

      {/* Engine toggle */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', width: 'fit-content', border: '1px solid var(--border)' }}>
        <button
          onClick={() => setEngine('claude')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          style={engine === 'claude'
            ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
            : { color: 'var(--text-secondary)' }}
        >
          Claude Hooks
        </button>
        <button
          onClick={() => setEngine('codex')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          style={engine === 'codex'
            ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
            : { color: 'var(--text-secondary)' }}
        >
          Codex Hooks
        </button>
      </div>

      {/* Codex hooks list */}
      {engine === 'codex' && (
        codexHooksLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="card p-4"><div className="skeleton h-5 w-64" /></div>)}
          </div>
        ) : !codexHooksData?.available ? (
          <div className="card p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No Codex hooks directory found at ~/.codex/hooks/</p>
          </div>
        ) : codexHooksData.hooks.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No hook files in ~/.codex/hooks/</p>
          </div>
        ) : (
          <div className="space-y-3">
            {codexHooksData.hooks.map((hook) => (
              <div key={hook.name} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{hook.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{hook.size} bytes</span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{relativeTime(new Date(hook.mtime * 1000).toISOString())}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Claude hooks: scope selector + tabs */}
      {engine === 'claude' && <>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Scope:</span>
        <button
          className="chip transition-all"
          onClick={() => setScope(SCOPE_GLOBAL)}
          style={{
            background: scope === SCOPE_GLOBAL ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
            color: scope === SCOPE_GLOBAL ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          Global
        </button>
        {projects?.map((p) => (
          <button
            key={p.id}
            className="chip transition-all"
            onClick={() => setScope(p.id)}
            style={{
              background: scope === p.id ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
              color: scope === p.id ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            {p.displayName}
          </button>
        ))}
      </div>

      <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as HookEvent)}>
        <Tabs.List
          className="flex gap-1 mb-5 p-1 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', width: 'fit-content', border: '1px solid var(--border)' }}
        >
          {EVENTS.map((event) => {
            const count = hooksData?.[event]?.length ?? 0;
            return (
              <Tabs.Trigger
                key={event}
                value={event}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                style={{ color: 'var(--text-secondary)' }}
              >
                {event}
                {count > 0 && (
                  <span
                    className="chip text-xs px-1.5 py-0.5"
                    style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                  >
                    {count}
                  </span>
                )}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>

        {EVENTS.map((event) => {
          const entries = hooksData?.[event] ?? [];
          return (
            <Tabs.Content key={event} value={event}>
              <div className="space-y-3">
                {isLoading ? (
                  [1, 2].map((i) => (
                    <div key={i} className="card p-4"><div className="skeleton h-5 w-64" /></div>
                  ))
                ) : entries.length === 0 ? (
                  <div className="card p-6 text-center">
                    <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                      No {event} hooks configured
                    </p>
                    <button
                      className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 mx-auto"
                      onClick={() => openCreate(event)}
                    >
                      <Plus size={12} /> Add Hook
                    </button>
                  </div>
                ) : (
                  <>
                    {entries.map((entry, idx) => (
                      <div key={idx} className="card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="chip font-mono text-xs" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                                {entry.matcher}
                              </span>
                            </div>
                            {entry.hooks.map((h, hi) => (
                              <code key={hi} className="text-xs block truncate" style={{ color: 'var(--text-secondary)' }}>
                                $ {h.command}
                              </code>
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {projectId && (
                              <button
                                className="p-1.5 rounded transition-colors"
                                title="Promote to Global"
                                onClick={() => promoteMut.mutate({ event, index: idx })}
                                style={{ color: 'var(--text-tertiary)' }}
                              >
                                <ArrowUpCircle size={14} />
                              </button>
                            )}
                            <button
                              className="p-1.5 rounded transition-colors"
                              onClick={() => openEdit(event, idx, entry)}
                              style={{ color: 'var(--text-tertiary)' }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="p-1.5 rounded transition-colors"
                              onClick={() => deleteMut.mutate({ event, index: idx })}
                              style={{ color: 'var(--text-tertiary)' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                      onClick={() => openCreate(event)}
                    >
                      <Plus size={12} /> Add Hook
                    </button>
                  </>
                )}
              </div>
            </Tabs.Content>
          );
        })}
      </Tabs.Root>
      </>}

      {/* Add/Edit dialog */}
      <Dialog.Root open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
              <Dialog.Title className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {editingIndex !== null ? 'Edit Hook' : 'Add Hook'}
              </Dialog.Title>
              <Dialog.Close className="p-1 rounded" style={{ color: 'var(--text-tertiary)' }}>
                <X size={16} />
              </Dialog.Close>
            </div>
            <div className="p-5 space-y-4">
              {editingIndex === null && (
                <label className="block">
                  <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Event</span>
                  <select
                    className="input w-full"
                    value={form.event}
                    onChange={(e) => setForm((f) => ({ ...f, event: e.target.value as HookEvent }))}
                  >
                    {EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Matcher (tool name or <code>*</code> for all)
                </span>
                <input
                  className="input w-full font-mono"
                  value={form.matcher}
                  onChange={(e) => setForm((f) => ({ ...f, matcher: e.target.value }))}
                  placeholder="Bash"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Command</span>
                <input
                  className="input w-full font-mono"
                  value={form.command}
                  onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
                  placeholder="echo 'hook fired'"
                />
              </label>
              {err && <p className="text-xs" style={{ color: 'var(--error)' }}>{err}</p>}
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <Dialog.Close className="btn-secondary text-sm px-3 py-1.5" onClick={closeModal}>
                Cancel
              </Dialog.Close>
              <button
                className="btn-primary text-sm px-3 py-1.5"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : editingIndex !== null ? 'Save Changes' : 'Add Hook'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      </>}
    </div>
  );
}
