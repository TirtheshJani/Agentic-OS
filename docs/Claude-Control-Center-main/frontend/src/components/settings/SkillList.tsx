import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import * as Dialog from '@radix-ui/react-dialog';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { Wand2, Plus, Trash2, X } from 'lucide-react';
import { useSkills } from '../../hooks/useSettings';
import { createSkill, deleteSkill } from '../../api/settings';

const ORIGIN_STYLES: Record<string, { bg: string; color: string }> = {
  'agent-marketplace': { bg: 'var(--accent-dim)', color: 'var(--accent)' },
  'local':             { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80' },
};

interface FormState {
  name: string;
  description: string;
  body: string;
}

export function SkillList() {
  const qc = useQueryClient();
  const { data: skills, isLoading } = useSkills();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '', description: '', body: '' });
  const [err, setErr] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.skills() });

  const createMut = useMutation({
    mutationFn: (f: FormState) => createSkill(f),
    onSuccess: () => { invalidate(); setModalOpen(false); setForm({ name: '', description: '', body: '' }); },
    onError: (e: Error) => setErr(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSkill(id),
    onSuccess: invalidate,
  });

  function handleCreate() {
    setErr('');
    if (!form.name.trim()) { setErr('Name is required'); return; }
    createMut.mutate(form);
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-start gap-3">
              <div className="skeleton w-8 h-8 rounded-lg flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-64" />
              </div>
            </div>
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
          onClick={() => { setModalOpen(true); setErr(''); setForm({ name: '', description: '', body: '' }); }}
        >
          <Plus size={13} /> New Skill
        </button>
      </div>

      {!skills?.length ? (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No skills found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => {
            const badgeStyle = ORIGIN_STYLES[skill.originType] ?? ORIGIN_STYLES['local'];
            const isLocal = skill.originType === 'local';
            return (
              <div key={skill.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'var(--accent-dim)' }}
                  >
                    <Wand2 size={14} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {skill.name}
                      </span>
                      <span
                        className="chip"
                        style={{ background: badgeStyle.bg, color: badgeStyle.color }}
                      >
                        {skill.originLabel}
                      </span>
                    </div>
                    {skill.description && (
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                        {skill.description}
                      </p>
                    )}
                  </div>
                  {isLocal && (
                    <button
                      className="p-1.5 rounded transition-colors flex-shrink-0"
                      onClick={() => deleteMut.mutate(skill.id)}
                      title="Delete skill"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog.Root open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-xl overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '90vh' }}
          >
            <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <Dialog.Title className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                New Skill
              </Dialog.Title>
              <Dialog.Close className="p-1 rounded" style={{ color: 'var(--text-tertiary)' }}>
                <X size={16} />
              </Dialog.Close>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <label className="block">
                <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Name</span>
                <input
                  className="input w-full"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="my-skill"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Description</span>
                <input
                  className="input w-full"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What this skill does"
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
              <Dialog.Close className="btn-secondary text-sm px-3 py-1.5">Cancel</Dialog.Close>
              <button
                className="btn-primary text-sm px-3 py-1.5"
                onClick={handleCreate}
                disabled={createMut.isPending}
              >
                {createMut.isPending ? 'Creating…' : 'Create Skill'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
