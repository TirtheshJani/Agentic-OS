import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search, RefreshCw, FileText, Plus, ChevronRight } from 'lucide-react';
import {
  fetchNotes, fetchNote, searchNotes, triggerVaultIngest, pushToVault, fetchVaultSyncStatus,
} from '../api/obsidian';
import { addRagDoc } from '../api/memoryRag';
import type { ObsidianNote } from '../api/obsidian';
import { relativeTime } from '../lib/utils';
import { cn } from '../lib/utils';

function groupByFolder(notes: ObsidianNote[]): Record<string, ObsidianNote[]> {
  return notes.reduce<Record<string, ObsidianNote[]>>((acc, note) => {
    const folder = note.folder || '(root)';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(note);
    return acc;
  }, {});
}

export function ObsidianVaultPage() {
  const { vaultId } = useParams<{ vaultId: string }>();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [showPushForm, setShowPushForm] = useState(false);
  const [pushTitle, setPushTitle] = useState('');
  const [pushContent, setPushContent] = useState('');
  const [pushFolder, setPushFolder] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['(root)']));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [searchQuery]);

  const { data: syncStatus } = useQuery({
    queryKey: queryKeys.obsidianSyncStatus(vaultId),
    queryFn: () => fetchVaultSyncStatus(vaultId!),
    enabled: !!vaultId,
    staleTime: 30_000,
  });

  const { data: allNotes = [], isLoading: notesLoading } = useQuery({
    queryKey: queryKeys.obsidianNotes(vaultId),
    queryFn: () => fetchNotes(vaultId!),
    enabled: !!vaultId && !debouncedSearch,
    staleTime: 30_000,
  });

  const { data: searchResults } = useQuery({
    queryKey: queryKeys.obsidianSearch(vaultId, debouncedSearch),
    queryFn: () => searchNotes(vaultId!, debouncedSearch),
    enabled: !!vaultId && !!debouncedSearch,
    staleTime: 10_000,
  });

  const displayNotes = debouncedSearch ? (searchResults ?? []) : allNotes;
  const grouped = groupByFolder(displayNotes);

  const { data: noteContent, isLoading: noteLoading } = useQuery({
    queryKey: queryKeys.obsidianNote(vaultId, selectedNote),
    queryFn: () => fetchNote(vaultId!, selectedNote!),
    enabled: !!vaultId && !!selectedNote,
    staleTime: 30_000,
  });

  const { mutate: sync, isPending: syncing } = useMutation({
    mutationFn: () => triggerVaultIngest(vaultId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.obsidianSyncStatus(vaultId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.obsidianNotes(vaultId) });
    },
  });

  const { mutate: push, isPending: pushing, isSuccess: pushed } = useMutation({
    mutationFn: () => pushToVault(vaultId!, pushTitle, pushContent, pushFolder || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.obsidianNotes(vaultId) });
      setShowPushForm(false);
      setPushTitle('');
      setPushContent('');
      setPushFolder('');
    },
  });

  const { mutate: addToRag, isPending: addingToRag, isSuccess: addedToRag } = useMutation({
    mutationFn: () => {
      if (!noteContent) throw new Error('No note loaded');
      return addRagDoc(noteContent.content, `obsidian:${selectedNote}`, []);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ragStatus() }),
  });

  function toggleFolder(folder: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }

  return (
    <div className="flex h-full" style={{ minHeight: 0 }}>
      <div className="flex flex-col w-72 flex-shrink-0 overflow-hidden" style={{ borderRight: '1px solid var(--border)' }}>
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {syncStatus?.notes_count ?? '—'} notes
            </span>
            {syncStatus?.last_synced && (
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                · {relativeTime(syncStatus.last_synced)}
              </span>
            )}
            <button
              onClick={() => sync()}
              disabled={syncing}
              className="ml-auto p-1 rounded hover:bg-white/10 transition-all disabled:opacity-40"
              title="Sync now"
            >
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
            <Search size={11} style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes…"
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {notesLoading && (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-4 rounded" />)}
            </div>
          )}

          {!notesLoading && displayNotes.length === 0 && (
            <div className="flex items-center justify-center p-8">
              <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                {debouncedSearch ? 'No matching notes.' : 'No notes in this vault.'}
              </p>
            </div>
          )}

          {!notesLoading && Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([folder, notes]) => (
            <div key={folder}>
              <button
                onClick={() => toggleFolder(folder)}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-white/[0.03] transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <ChevronRight size={11} className={cn('transition-transform', expandedFolders.has(folder) && 'rotate-90')} />
                {folder}
                <span className="ml-auto">{notes.length}</span>
              </button>
              {expandedFolders.has(folder) && notes.map((note) => (
                <button
                  key={note.path}
                  onClick={() => setSelectedNote(note.path)}
                  className={cn(
                    'w-full text-left flex items-center gap-2 pl-7 pr-3 py-1.5 text-xs hover:bg-white/[0.04] transition-colors',
                    selectedNote === note.path && 'bg-white/[0.06]',
                  )}
                  style={{ color: selectedNote === note.path ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                  <FileText size={10} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
                  <span className="truncate">{note.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          {selectedNote && noteContent && (
            <>
              <span className="text-sm font-medium truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                {noteContent.path.split('/').pop()}
              </span>
              <button
                onClick={() => !addingToRag && !addedToRag && addToRag()}
                disabled={addingToRag || addedToRag}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs hover:bg-white/10 transition-all disabled:opacity-40"
                style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                {addedToRag ? 'Added to RAG' : addingToRag ? 'Adding…' : 'Add to RAG'}
              </button>
            </>
          )}
          <button
            onClick={() => setShowPushForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:bg-white/10"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            <Plus size={11} /> Push to Vault
          </button>
        </div>

        {showPushForm && (
          <div className="px-5 py-4 space-y-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Title</span>
                <input type="text" value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} placeholder="Note title" className="w-full px-2 py-1.5 text-xs rounded-md bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
              </label>
              <label className="block">
                <span className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Folder (optional)</span>
                <input type="text" value={pushFolder} onChange={(e) => setPushFolder(e.target.value)} placeholder="Inbox" className="w-full px-2 py-1.5 text-xs rounded-md bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
              </label>
            </div>
            <label className="block">
              <span className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Content</span>
              <textarea value={pushContent} onChange={(e) => setPushContent(e.target.value)} rows={4} placeholder="Markdown content…" className="w-full px-2 py-1.5 text-xs rounded-md bg-transparent resize-y" style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
            </label>
            <div className="flex gap-2">
              <button onClick={() => push()} disabled={pushing || !pushTitle.trim()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-40" style={{ background: 'var(--accent)', color: '#fff' }}>
                {pushing ? 'Pushing…' : pushed ? 'Pushed!' : 'Push'}
              </button>
              <button onClick={() => setShowPushForm(false)} className="px-3 py-1.5 rounded-md text-xs hover:bg-white/10 transition-all" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          {!selectedNote && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <FileText size={32} style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Select a note to view its contents</p>
            </div>
          )}

          {selectedNote && noteLoading && (
            <div className="space-y-3 max-w-3xl">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-4 rounded" />)}
            </div>
          )}

          {selectedNote && noteContent && !noteLoading && (
            <div className="max-w-3xl prose-dark">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{noteContent.content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
