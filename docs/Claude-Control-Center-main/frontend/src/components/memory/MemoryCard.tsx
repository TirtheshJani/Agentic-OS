import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Edit2, Trash2 } from 'lucide-react';
import { TypeBadge } from './TypeBadge';
import { useDeleteMemory } from '../../hooks/useMemory';
import { useUIStore } from '../../store/uiStore';
import { truncate } from '../../lib/utils';
import type { MemoryFile } from '../../types';

interface Props {
  file: MemoryFile;
  projectId: string;
}

export function MemoryCard({ file, projectId }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = useDeleteMemory(projectId);
  const { openMemoryEditor } = useUIStore();

  async function handleDelete() {
    await deleteMutation.mutateAsync(file.filename);
    setDeleteOpen(false);
  }

  return (
    <div className="card p-4 flex flex-col gap-2 animate-fade-in">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
          {file.name || file.filename}
        </h3>
        <TypeBadge type={file.type} />
      </div>

      {file.description && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {truncate(file.description, 120)}
        </p>
      )}

      {file.body && (
        <p className="text-xs font-mono leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          {truncate(file.body.replace(/^---[\s\S]*?---\n?/, '').trim(), 100)}
        </p>
      )}

      <div className="flex items-center gap-2 mt-1">
        <span className="chip" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-tertiary)' }}>
          {file.filename}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => openMemoryEditor(projectId, file.filename)}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Edit"
          >
            <Edit2 size={12} style={{ color: 'var(--text-secondary)' }} />
          </button>

          <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
            <Dialog.Trigger asChild>
              <button className="p-1.5 rounded hover:bg-white/10 transition-colors" title="Delete">
                <Trash2 size={12} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
              <Dialog.Content
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-xl p-6 w-80"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <Dialog.Title className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Delete memory file?
                </Dialog.Title>
                <Dialog.Description className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>
                  This will permanently delete <strong>{file.filename}</strong> and update the memory index.
                </Dialog.Description>
                <div className="flex gap-3 justify-end">
                  <Dialog.Close asChild>
                    <button className="btn-secondary text-xs">Cancel</button>
                  </Dialog.Close>
                  <button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="btn-primary text-xs"
                    style={{ background: 'var(--error)' }}
                  >
                    {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </div>
  );
}
