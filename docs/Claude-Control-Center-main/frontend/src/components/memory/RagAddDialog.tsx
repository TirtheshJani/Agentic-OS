import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { addRagDoc } from '../../api/memoryRag';
import { queryKeys } from '../../lib/queryKeys';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RagAddDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [source, setSource] = useState('manual');
  const [tagsRaw, setTagsRaw] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { mutate, isPending, isError, error } = useMutation({
    mutationFn: () => {
      const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
      return addRagDoc(content, source, tags);
    },
    onSuccess: () => {
      setSuccessMsg('Document added to knowledge base.');
      setContent('');
      setTagsRaw('');
      queryClient.invalidateQueries({ queryKey: queryKeys.ragStatus() });
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1500);
    },
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-lg overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Add to Knowledge Base
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-all"
          >
            <X size={14} style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              Content
            </span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Paste or type the content to add to RAG memory…"
              className="w-full px-3 py-2 text-xs rounded-md bg-transparent resize-y"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              Source
            </span>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-md bg-transparent"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              Tags (comma-separated)
            </span>
            <input
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className="w-full px-3 py-2 text-xs rounded-md bg-transparent"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </label>

          {isError && (
            <p className="text-xs" style={{ color: 'var(--error)' }}>
              {error instanceof Error ? error.message : 'Failed to add document.'}
            </p>
          )}

          {successMsg && (
            <p className="text-xs" style={{ color: '#4ade80' }}>{successMsg}</p>
          )}
        </div>

        <div
          className="flex justify-end gap-2 px-5 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs hover:bg-white/10 transition-all"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => content.trim() && mutate()}
            disabled={isPending || !content.trim()}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {isPending ? 'Adding…' : 'Add to RAG'}
          </button>
        </div>
      </div>
    </div>
  );
}
