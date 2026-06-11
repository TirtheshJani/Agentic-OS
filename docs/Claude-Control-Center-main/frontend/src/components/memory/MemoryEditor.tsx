import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { X, ChevronDown } from 'lucide-react';
import { useCreateMemory, useUpdateMemory } from '../../hooks/useMemory';
import { useUIStore } from '../../store/uiStore';
import { useQueryClient } from '@tanstack/react-query';
import { fetchMemoryFile } from '../../api/memory';
import { queryKeys } from '../../lib/queryKeys';

const MEMORY_TYPES = ['project', 'user', 'feedback', 'reference'];

export function MemoryEditor() {
  const { memoryEditorOpen, memoryEditorTarget, memoryEditorProjectId, closeMemoryEditor } = useUIStore();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('project');
  const [filename, setFilename] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createMutation = useCreateMemory(memoryEditorProjectId ?? '');
  const updateMutation = useUpdateMemory(memoryEditorProjectId ?? '');

  // Load existing file when editing
  useEffect(() => {
    if (memoryEditorOpen && memoryEditorTarget && memoryEditorProjectId) {
      setLoading(true);
      fetchMemoryFile(memoryEditorProjectId, memoryEditorTarget)
        .then((data) => {
          setName(data.frontmatter.name || '');
          setDescription(data.frontmatter.description || '');
          setType(data.frontmatter.type || 'project');
          setFilename(data.filename);
          setBody(data.body);
        })
        .catch(() => setError('Failed to load memory file'))
        .finally(() => setLoading(false));
    } else if (memoryEditorOpen && !memoryEditorTarget) {
      setName('');
      setDescription('');
      setType('project');
      setFilename('');
      setBody('');
      setError('');
    }
  }, [memoryEditorOpen, memoryEditorTarget, memoryEditorProjectId]);

  async function handleSave() {
    if (!memoryEditorProjectId) return;
    setError('');
    try {
      if (memoryEditorTarget) {
        await updateMutation.mutateAsync({
          filename: memoryEditorTarget,
          data: { name, description, type, body },
        });
      } else {
        await createMutation.mutateAsync({ filename, name, description, type, body });
      }
      qc.invalidateQueries({ queryKey: queryKeys.memory(memoryEditorProjectId) });
      closeMemoryEditor();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog.Root open={memoryEditorOpen} onOpenChange={(open) => !open && closeMemoryEditor()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-4 md:inset-x-[10%] md:inset-y-[5%] z-50 flex flex-col rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <Dialog.Title className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {memoryEditorTarget ? 'Edit Memory' : 'New Memory'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-md hover:bg-white/10 transition-colors">
                <X size={14} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 flex min-h-0">
            {/* Left: metadata form */}
            <div className="w-72 flex-shrink-0 p-5 space-y-4 overflow-y-auto"
              style={{ borderRight: '1px solid var(--border)' }}>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-9" />)}
                </div>
              ) : (
                <>
                  {!memoryEditorTarget && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Filename <span style={{ color: 'var(--error)' }}>*</span>
                      </label>
                      <input
                        className="input-field"
                        placeholder="my_memory.md"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Name</label>
                    <input
                      className="input-field"
                      placeholder="Memory name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Description</label>
                    <textarea
                      className="input-field resize-none"
                      rows={3}
                      placeholder="What does this memory capture?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Type</label>
                    <Select.Root value={type} onValueChange={setType}>
                      <Select.Trigger
                        className="input-field flex items-center justify-between"
                        style={{ cursor: 'pointer' }}
                      >
                        <Select.Value />
                        <Select.Icon><ChevronDown size={13} /></Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Content
                          className="rounded-lg py-1 shadow-xl z-[100]"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', minWidth: 180 }}
                        >
                          <Select.Viewport>
                            {MEMORY_TYPES.map((t) => (
                              <Select.Item
                                key={t}
                                value={t}
                                className="px-3 py-2 text-sm cursor-pointer outline-none capitalize hover:bg-white/[0.06] transition-colors"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                <Select.ItemText>{t}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  </div>
                </>
              )}
            </div>

            {/* Right: editor */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <div className="px-3 py-1.5 text-xs" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
                Markdown content
              </div>
              <div className="flex-1 overflow-hidden">
                <CodeMirror
                  value={body}
                  onChange={setBody}
                  extensions={[markdown()]}
                  theme={oneDark}
                  height="100%"
                  style={{ height: '100%' }}
                  basicSetup={{ lineNumbers: true, foldGutter: false }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: '1px solid var(--border)' }}>
            {error && <p className="text-xs" style={{ color: 'var(--error)' }}>{error}</p>}
            <div className="flex items-center gap-3 ml-auto">
              <Dialog.Close asChild>
                <button className="btn-secondary text-sm">Cancel</button>
              </Dialog.Close>
              <button
                className="btn-primary text-sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
