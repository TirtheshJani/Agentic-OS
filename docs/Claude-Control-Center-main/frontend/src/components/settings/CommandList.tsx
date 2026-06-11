import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import * as Dialog from '@radix-ui/react-dialog';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { Terminal, Plus, Pencil, Trash2, X } from 'lucide-react';
import { useCommands } from '../../hooks/useSettings';
import { createCommand, updateCommand, deleteCommand } from '../../api/settings';
import type { Command } from '../../types';

interface FormState {
  name: string;
  description: string;
  argumentHint: string;
  allowedTools: string;
  body: string;
}

const emptyForm = (): FormState => ({
  name: '', description: '', argumentHint: '', allowedTools: '', body: '',
});

function cmdToForm(cmd: Command): FormState {
  return {
    name: cmd.name,
    description: cmd.description,
    argumentHint: cmd.argumentHint,
    allowedTools: cmd.allowedTools.join(', '),
    body: cmd.body,
  };
}

export function CommandList() {
  const qc = useQueryClient();
  const { data: commands, isLoading } = useCommands();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Command | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [err, setErr] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.commands() });

  const createMut = useMutation({
    mutationFn: (f: FormState) => createCommand({
      name: f.name,
      description: f.description,
      argumentHint: f.argumentHint,
      allowedTools: f.allowedTools ? f.allowedTools.split(',').map((s) => s.trim()).filter(Boolean) : [],
      body: f.body,
    }),
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (e: Error) => setErr(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (f: FormState) => updateCommand(editing!.filename, {
      description: f.description,
      argumentHint: f.argumentHint,
      allowedTools: f.allowedTools ? f.allowedTools.split(',').map((s) => s.trim()).filter(Boolean) : [],
      body: f.body,
    }),
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (e: Error) => setErr(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (filename: string) => deleteCommand(filename),
    onSuccess: invalidate,
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setErr('');
    setModalOpen(true);
  }

  function openEdit(cmd: Command) {
    setEditing(cmd);
    setForm(cmdToForm(cmd));
    setErr('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSave() {
    setErr('');
    if (!form.name.trim() && !editing) { setErr('Name is required'); return; }
    if (editing) updateMut.mutate(form);
    else createMut.mutate(form);
  }

  const saving = createMut.isPending || updateMut.isPending;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-2">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
          onClick={openCreate}
        >
          <Plus size={13} /> New Command
        </button>
      </div>

      {!commands?.length ? (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No custom commands found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {commands.map((cmd) => (
            <div key={cmd.filename} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(249,115,22,0.12)' }}>
                  <Terminal size={13} style={{ color: '#fb923c' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                      /{cmd.name}
                    </span>
                    {cmd.argumentHint && (
                      <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {cmd.argumentHint}
                      </span>
                    )}
                  </div>
                  {cmd.description && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {cmd.description}
                    </p>
                  )}
                  {cmd.allowedTools.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Tools:</span>
                      {cmd.allowedTools.map((t) => (
                        <span key={t} className="chip" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    className="p-1.5 rounded transition-colors"
                    onClick={() => openEdit(cmd)}
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="p-1.5 rounded transition-colors"
                    onClick={() => deleteMut.mutate(cmd.filename)}
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog.Root open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-xl overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '90vh' }}
          >
            <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <Dialog.Title className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {editing ? `Edit /${editing.name}` : 'New Command'}
              </Dialog.Title>
              <Dialog.Close className="p-1 rounded" style={{ color: 'var(--text-tertiary)' }}>
                <X size={16} />
              </Dialog.Close>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {!editing && (
                <label className="block">
                  <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Name (slug)</span>
                  <input
                    className="input w-full font-mono"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="my-command"
                  />
                </label>
              )}
              <label className="block">
                <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Description</span>
                <input
                  className="input w-full"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What this command does"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Argument hint</span>
                <input
                  className="input w-full font-mono"
                  value={form.argumentHint}
                  onChange={(e) => setForm((f) => ({ ...f, argumentHint: e.target.value }))}
                  placeholder="[filename]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Allowed tools (comma-separated)</span>
                <input
                  className="input w-full"
                  value={form.allowedTools}
                  onChange={(e) => setForm((f) => ({ ...f, allowedTools: e.target.value }))}
                  placeholder="Bash, Read, Write"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Body (markdown)</span>
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', height: 200 }}>
                  <CodeMirror
                    value={form.body}
                    extensions={[markdown()]}
                    theme={oneDark}
                    onChange={(val) => setForm((f) => ({ ...f, body: val }))}
                    height="200px"
                    style={{ fontSize: 12 }}
                  />
                </div>
              </label>
              {err && <p className="text-xs" style={{ color: 'var(--error)' }}>{err}</p>}
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5 flex-shrink-0">
              <Dialog.Close className="btn-secondary text-sm px-3 py-1.5" onClick={closeModal}>Cancel</Dialog.Close>
              <button
                className="btn-primary text-sm px-3 py-1.5"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Command'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
