"use client";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { NewNoteModal } from "@/components/notes/NewNoteModal";
import { useStream } from "@/hooks/useStream";

interface NoteRow {
  path: string;
  title: string;
  folder: string;
  mtime: number;
}

export function NotesPanel() {
  const [notes, setNotes] = useState<NoteRow[] | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [folder, setFolder] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<{ path: string; content: string } | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const reloadList = useCallback(async () => {
    try {
      const qs = folder ? `?folder=${encodeURIComponent(folder)}` : "";
      const res = await fetch(`/api/vault/list${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNotes(data.notes);
      setFolders(data.folders);
      setListError(null);
    } catch (err) {
      setListError((err as Error).message);
    }
  }, [folder]);

  const loadNote = useCallback(async (path: string) => {
    try {
      const res = await fetch(`/api/notes?path=${encodeURIComponent(path)}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setNote({ path: data.path, content: data.content });
      setNoteError(null);
    } catch (err) {
      setNoteError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void reloadList();
  }, [reloadList]);

  useEffect(() => {
    if (selected) void loadNote(selected);
    else setNote(null);
  }, [selected, loadNote]);

  useStream((event) => {
    if (event.kind !== "vault.indexed") return;
    void reloadList();
    // The open note may have changed on disk; the editor ignores this while dirty.
    if (selected) void loadNote(selected);
  });

  return (
    <>
      <div className="flex gap-4 h-[calc(100vh-9rem)] min-h-[400px]">
        <aside className="w-[280px] shrink-0 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2">
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="flex-1 min-w-0 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm"
            >
              <option value="">All folders</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <Button variant="primary" onClick={() => setShowNew(true)}>
              New note
            </Button>
          </div>
          {listError && <p className="text-sm text-red-600">{listError}</p>}
          {!notes && !listError && <p className="text-sm text-gray-400">Loading notes...</p>}
          {notes && notes.length === 0 && <p className="text-sm text-gray-400">No notes in this folder.</p>}
          {notes && notes.length > 0 && (
            <div className="flex-1 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-900">
              {notes.map((n) => (
                <button
                  key={n.path}
                  onClick={() => setSelected(n.path)}
                  className={clsx(
                    "block w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-900",
                    selected === n.path && "bg-blue-50 dark:bg-blue-950"
                  )}
                >
                  <span className="block text-sm font-medium truncate">{n.title}</span>
                  <span className="block text-xs text-gray-400 font-mono truncate">{n.path}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="flex-1 min-w-0 min-h-0">
          {!selected ? (
            <EmptyState title="No note selected" description="Pick a note from the list or create a new one." />
          ) : noteError ? (
            <p className="text-sm text-red-600">{noteError}</p>
          ) : note && note.path === selected ? (
            <NoteEditor key={note.path} path={note.path} content={note.content} onSaved={() => void loadNote(note.path)} />
          ) : (
            <p className="text-sm text-gray-400">Loading note...</p>
          )}
        </section>
      </div>

      {showNew && (
        <NewNoteModal
          onClose={() => setShowNew(false)}
          onCreated={(relPath) => {
            setShowNew(false);
            setSelected(relPath);
            void reloadList();
          }}
        />
      )}
    </>
  );
}
