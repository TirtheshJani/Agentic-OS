import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare, FileText, Loader2 } from 'lucide-react';
import { useSearch } from '../../hooks/useSearch';
import { useUIStore } from '../../store/uiStore';
import type { ConversationHit, MemoryHit } from '../../api/search';

type Item =
  | { kind: 'conversation'; hit: ConversationHit }
  | { kind: 'memory'; hit: MemoryHit };

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const { data, isFetching } = useSearch(query);

  // Reset and focus when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    if (!data) return [];
    return [
      ...data.conversations.map((hit) => ({ kind: 'conversation' as const, hit })),
      ...data.memory.map((hit) => ({ kind: 'memory' as const, hit })),
    ];
  }, [data]);

  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, items.length - 1)));
  }, [items.length]);

  if (!open) return null;

  const go = (item: Item) => {
    if (item.kind === 'conversation') {
      const { projectId, sessionId, messageUuid } = item.hit;
      const base = `/conversations/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}`;
      navigate(messageUuid ? `${base}?msg=${encodeURIComponent(messageUuid)}` : base);
    } else {
      navigate(`/memory/${encodeURIComponent(item.hit.projectId)}`);
    }
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => (items.length ? (s + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => (items.length ? (s - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[selected];
      if (item) go(item);
    }
  };

  const trimmed = query.trim();
  const showHint = trimmed.length < 3;
  const empty = !showHint && !isFetching && items.length === 0;
  const convCount = data?.conversations.length ?? 0;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setOpen(false)} />
      <div
        className="fixed left-1/2 top-[12vh] z-50 -translate-x-1/2 w-full max-w-2xl card flex flex-col overflow-hidden"
        style={{ maxHeight: '70vh' }}
        onKeyDown={onKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <Search size={15} style={{ color: 'var(--text-tertiary)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations and memory…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
          {isFetching && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />}
          <span className="kbd">Esc</span>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto py-1">
          {showHint && (
            <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Type at least 3 characters to search.
            </div>
          )}
          {empty && (
            <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
              No matches for “{trimmed}”.
            </div>
          )}

          {!showHint && convCount > 0 && (
            <>
              <SectionHeader label="Conversations" />
              {data!.conversations.map((hit, i) => {
                const item: Item = { kind: 'conversation', hit };
                return (
                  <ResultRow
                    key={hit.sessionId}
                    item={item}
                    active={i === selected}
                    onSelect={() => go(item)}
                    onHover={() => setSelected(i)}
                  />
                );
              })}
            </>
          )}
          {!showHint && (data?.memory.length ?? 0) > 0 && (
            <>
              <SectionHeader label="Memory" />
              {data!.memory.map((hit, j) => {
                const i = convCount + j;
                const item: Item = { kind: 'memory', hit };
                return (
                  <ResultRow
                    key={`${hit.projectId}/${hit.filename}`}
                    item={item}
                    active={i === selected}
                    onSelect={() => go(item)}
                    onHover={() => setSelected(i)}
                  />
                );
              })}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider"
      style={{ color: 'var(--text-tertiary)' }}
    >
      {label}
    </div>
  );
}

function ResultRow({
  item,
  active,
  onSelect,
  onHover,
}: {
  item: Item;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const isConv = item.kind === 'conversation';
  const title = isConv
    ? item.hit.slug || `${item.hit.projectName} · ${item.hit.sessionId.slice(0, 8)}`
    : item.hit.name;
  const meta = isConv ? item.hit.projectName : `${item.hit.projectName} · ${item.hit.filename}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseMove={onHover}
      className="w-full text-left px-4 py-2 flex items-start gap-3 transition-colors"
      style={{ background: active ? 'var(--bg-hover, rgba(127,127,127,0.12))' : 'transparent' }}
    >
      {isConv ? (
        <MessageSquare size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
      ) : (
        <FileText size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{title}</span>
          {isConv && (
            <span className="chip shrink-0" style={{ fontSize: 10 }}>
              {item.hit.matchCount}
            </span>
          )}
          {isConv && (
            <span className="text-[10px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>
              {relativeTime(item.hit.lastMessageAt)}
            </span>
          )}
        </div>
        <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{item.hit.snippet}</div>
        <div className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>{meta}</div>
      </div>
    </button>
  );
}
