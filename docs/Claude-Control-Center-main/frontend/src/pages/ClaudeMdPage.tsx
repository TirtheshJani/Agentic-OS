import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import * as Dialog from '@radix-ui/react-dialog';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { FileText, Plus, Trash2, Save, X, Globe, FolderGit2 } from 'lucide-react';
import {
  fetchClaudeMdFiles, fetchClaudeMdContent, updateClaudeMd,
  createClaudeMd, deleteClaudeMd,
} from '../api/claudeMd';
import type { ClaudeMdFile } from '../types';

export function ClaudeMdPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [createErr, setCreateErr] = useState('');

  const { data: files = [], isLoading: listLoading } = useQuery({
    queryKey: queryKeys.claudeMdFiles(),
    queryFn: fetchClaudeMdFiles,
  });

  const { data: fileContent, isLoading: contentLoading, isError: contentError } = useQuery({
    queryKey: queryKeys.claudeMdContent(selectedId),
    queryFn: () => fetchClaudeMdContent(selectedId!),
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (fileContent) {
      setContent(fileContent.content);
      setDirty(false);
    }
  }, [fileContent]);

  const saveMut = useMutation({
    mutationFn: () => updateClaudeMd(selectedId!, content),
    onSuccess: () => setDirty(false),
  });

  const createMut = useMutation({
    mutationFn: () => createClaudeMd(newPath),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.claudeMdFiles() });
      setSelectedId(res.id);
      setCreateOpen(false);
      setNewPath('');
    },
    onError: (e: Error) => setCreateErr(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteClaudeMd(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.claudeMdFiles() });
      if (selectedId === id) setSelectedId(null);
    },
  });

  const selected = files.find((f) => f.id === selectedId);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText size={18} style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>CLAUDE.md</h1>
        </div>
        <button
          className="btn-primary flex items-center gap-2 text-sm px-3 py-1.5"
          onClick={() => { setCreateOpen(true); setCreateErr(''); setNewPath(''); }}
        >
          <Plus size={14} /> New File
        </button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* File list */}
        <div className="w-64 flex-shrink-0 space-y-1 overflow-y-auto">
          {listLoading ? (
            [1, 2, 3].map((i) => <div key={i} className="card p-3"><div className="skeleton h-4 w-full" /></div>)
          ) : files.length === 0 ? (
            <div className="card p-4 text-center">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No CLAUDE.md files found</p>
            </div>
          ) : (
            files.map((f) => (
              <div
                key={f.id}
                className="group card px-3 py-2.5 cursor-pointer flex items-start gap-2"
                onClick={() => setSelectedId(f.id)}
                style={{
                  background: selectedId === f.id ? 'var(--accent-dim)' : undefined,
                  border: selectedId === f.id ? '1px solid var(--accent-border, var(--accent))' : undefined,
                }}
              >
                {f.scope === 'global' ? (
                  <Globe size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                ) : (
                  <FolderGit2 size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{f.label}</p>
                  {f.scope === 'project' && (
                    <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{f.projectName}</p>
                  )}
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 p-0.5 flex-shrink-0"
                  onClick={(e) => { e.stopPropagation(); deleteMut.mutate(f.id); }}
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0 flex flex-col">
          {!selectedId ? (
            <div className="card flex-1 flex items-center justify-center">
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Select a file to edit
              </p>
            </div>
          ) : contentLoading ? (
            <div className="card flex-1 flex items-center justify-center">
              <div className="skeleton h-4 w-32" />
            </div>
          ) : contentError ? (
            <div className="card flex-1 flex items-center justify-center">
              <p className="text-sm" style={{ color: 'var(--error, #f87171)' }}>
                Failed to load file — it may have been moved or is outside an allowed directory.
              </p>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {selected?.path}
                </p>
                <button
                  className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
                  onClick={() => saveMut.mutate()}
                  disabled={!dirty || saveMut.isPending}
                >
                  <Save size={13} />
                  {saveMut.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
              <div
                className="flex-1 min-h-0 rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--border)' }}
              >
                <CodeMirror
                  value={content}
                  extensions={[markdown()]}
                  theme={oneDark}
                  onChange={(val) => { setContent(val); setDirty(true); }}
                  height="100%"
                  style={{ height: '100%', fontSize: 13 }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog.Root open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
              <Dialog.Title className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                New CLAUDE.md
              </Dialog.Title>
              <Dialog.Close className="p-1 rounded" style={{ color: 'var(--text-tertiary)' }}>
                <X size={16} />
              </Dialog.Close>
            </div>
            <div className="p-5 space-y-4">
              <label className="block">
                <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Absolute file path
                </span>
                <input
                  className="input w-full font-mono"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  placeholder="/home/user/project/CLAUDE.md"
                />
              </label>
              {createErr && <p className="text-xs" style={{ color: 'var(--error)' }}>{createErr}</p>}
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <Dialog.Close className="btn-secondary text-sm px-3 py-1.5">Cancel</Dialog.Close>
              <button
                className="btn-primary text-sm px-3 py-1.5"
                onClick={() => createMut.mutate()}
                disabled={!newPath.trim() || createMut.isPending}
              >
                {createMut.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
