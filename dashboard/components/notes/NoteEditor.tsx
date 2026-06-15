"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/common/Button";

interface Suggestion {
  title: string;
  path: string;
  basename: string;
}

interface NoteEditorProps {
  path: string;
  content: string;
  onSaved?: () => void;
}

export function NoteEditor({ path, content, onSaved }: NoteEditorProps) {
  const [draft, setDraft] = useState(content);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  // Span of the partial "[[query" in the draft: start = index of "[[", end = caret.
  const [linkCtx, setLinkCtx] = useState<{ start: number; end: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fetchSeq = useRef(0);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Server content changed (vault.indexed reload). Local edits are authoritative while dirty.
  useEffect(() => {
    if (!dirtyRef.current) setDraft(content);
  }, [content]);

  async function fetchSuggestions(q: string) {
    const seq = ++fetchSeq.current;
    try {
      const res = await fetch(`/api/vault/suggest?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (seq === fetchSeq.current) setSuggestions(data.suggestions ?? []);
    } catch {
      // Autocomplete is best-effort; ignore fetch failures.
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setDraft(value);
    setDirty(true);
    const caret = e.target.selectionStart;
    const match = value.slice(0, caret).match(/\[\[([^[\]\n]+)$/);
    if (match) {
      setLinkCtx({ start: caret - match[1].length - 2, end: caret });
      void fetchSuggestions(match[1]);
    } else {
      setLinkCtx(null);
      setSuggestions([]);
    }
  }

  function insertLink(basename: string) {
    if (!linkCtx) return;
    const next = `${draft.slice(0, linkCtx.start)}[[${basename}]]${draft.slice(linkCtx.end)}`;
    const pos = linkCtx.start + basename.length + 4;
    setDraft(next);
    setDirty(true);
    setLinkCtx(null);
    setSuggestions([]);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/vault/note", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content: draft }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setDirty(false);
      onSaved?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && linkCtx) {
      e.preventDefault();
      setLinkCtx(null);
      setSuggestions([]);
      return;
    }
    if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void save();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 mb-2">
        <span className="flex-1 min-w-0 text-xs text-ink3 font-mono truncate">{path}</span>
        {dirty && <span className="text-xs text-warn">Unsaved changes</span>}
        <Button variant="primary" onClick={() => void save()} disabled={!dirty || saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className="flex-1 w-full resize-none rounded-card border border-line2 bg-surface px-3 py-2 text-sm font-mono leading-relaxed text-ink focus:outline-none focus:ring-2 focus:ring-accent-line"
      />
      {linkCtx && suggestions.length > 0 && (
        <div className="mt-1 rounded-card border border-line bg-surface divide-y divide-line max-h-40 overflow-y-auto shadow-card">
          {suggestions.map((s) => (
            <button
              key={s.path}
              onClick={() => insertLink(s.basename)}
              className="block w-full text-left px-3 py-1.5 text-sm text-ink2 hover:bg-surface2"
            >
              <span className="font-medium text-ink">[[{s.basename}]]</span>
              <span className="text-xs text-ink3 font-mono ml-2">{s.path}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
