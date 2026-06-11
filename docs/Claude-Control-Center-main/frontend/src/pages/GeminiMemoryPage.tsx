import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import {
  Database, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Search, FileText, Save, Plus, BookOpen, History,
} from 'lucide-react';
import {
  fetchGeminiMemory, fetchGeminiMd, updateGeminiMd, fetchClaudeMemories,
} from '../api/gemini';
import type { ClaudeMemoryEntry } from '../api/gemini';
import { absoluteTime } from '../lib/utils';

type Tab = 'gemini-md' | 'claude-memories' | 'history';

// ── GEMINI.md editor tab ────────────────────────────────────────────────────

function GeminiMdTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.geminiMd(),
    queryFn: fetchGeminiMd,
    staleTime: 30_000,
  });

  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setDraft(data.content);
  }, [data]);

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => updateGeminiMd(draft),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: queryKeys.geminiMd() });
    },
  });

  const isDirty = data ? draft !== data.content : false;

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          This file is read by Gemini CLI as persistent context — edit it to give Gemini lasting instructions.
        </p>
        {data?.path && (
          <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{data.path}</span>
        )}
      </div>

      <div className="card flex-1 flex flex-col min-h-0">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="skeleton w-full h-48 rounded-md" />
          </div>
        ) : (
          <textarea
            className="flex-1 w-full p-4 bg-transparent text-xs font-mono resize-none outline-none leading-relaxed"
            style={{ color: 'var(--text-primary)', minHeight: 320 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="# Gemini CLI Context&#10;&#10;Add persistent instructions, project context, or memory here.&#10;Gemini CLI will read this file automatically."
            spellCheck={false}
          />
        )}
        <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all disabled:opacity-40"
            style={{ background: isDirty ? 'var(--accent)' : 'rgba(255,255,255,0.05)', color: isDirty ? '#000' : 'var(--text-secondary)', border: '1px solid var(--border)' }}
            onClick={() => save()}
            disabled={!isDirty || saving}
          >
            <Save size={11} />
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </button>
          {!isDirty && !saving && (
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No unsaved changes</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Claude memories tab ─────────────────────────────────────────────────────

function ClaudeMemoryCard({ entry }: { entry: ClaudeMemoryEntry }) {
  const queryClient = useQueryClient();
  const [appended, setAppended] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { mutate: appendToGeminiMd, isPending } = useMutation({
    mutationFn: async () => {
      const current = await fetchGeminiMd();
      const separator = current.content && !current.content.endsWith('\n') ? '\n' : '';
      const addition = `${separator}\n## ${entry.name} (from Claude: ${entry.project})\n\n${entry.body}\n`;
      return updateGeminiMd(current.content + addition);
    },
    onSuccess: () => {
      setAppended(true);
      setTimeout(() => setAppended(false), 2500);
      queryClient.invalidateQueries({ queryKey: queryKeys.geminiMd() });
    },
  });

  return (
    <div className="card px-4 py-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{entry.name}</span>
            <span className="chip text-[10px]" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}>{entry.project}</span>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{entry.filename}</span>
          </div>
          {entry.description && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{entry.description}</p>
          )}
        </div>
        <button
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs flex-shrink-0 transition-all disabled:opacity-40"
          style={{ border: '1px solid var(--border)', color: appended ? 'var(--success)' : 'var(--text-secondary)' }}
          onClick={() => appendToGeminiMd()}
          disabled={isPending || appended}
        >
          <Plus size={11} />
          {appended ? 'Appended!' : isPending ? 'Appending…' : 'Add to GEMINI.md'}
        </button>
      </div>

      {entry.body && (
        <>
          <button
            className="flex items-center gap-1 text-xs self-start"
            style={{ color: 'var(--text-tertiary)' }}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {expanded ? 'Hide content' : 'Show content'}
          </button>
          {expanded && (
            <pre className="text-xs leading-relaxed overflow-auto p-3 rounded-md max-h-48" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {entry.body}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

function ClaudeMemoriesTab() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.claudeMemories(),
    queryFn: fetchClaudeMemories,
    staleTime: 60_000,
  });

  const items = data?.items ?? [];
  const filtered = search
    ? items.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.project.toLowerCase().includes(search.toLowerCase()) ||
        e.body.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-2">
        <Search size={12} style={{ color: 'var(--text-tertiary)' }} />
        <input
          type="text"
          placeholder="Search Claude memories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
        {data && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{filtered.length} entries</span>}
      </div>

      <div className="flex-1 overflow-auto flex flex-col gap-3">
        {isLoading && (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-md" />)
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <BookOpen size={32} style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {search ? 'No matching memories.' : 'No Claude project memories found.'}
            </p>
            <p className="text-xs text-center max-w-sm" style={{ color: 'var(--text-tertiary)' }}>
              Claude memories live in ~/.claude/projects/&lt;project&gt;/memory/*.md
            </p>
          </div>
        )}
        {!isLoading && filtered.map((entry, i) => (
          <ClaudeMemoryCard key={`${entry.project}-${entry.filename}-${i}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}

// ── History tab (unchanged) ─────────────────────────────────────────────────

interface HistoryItem {
  session_id: string;
  ts: number;
  text: string;
  datetime: string;
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div
        className="grid gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
        style={{ gridTemplateColumns: '3fr 1fr 1fr 24px', borderBottom: '1px solid var(--border)' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }} title={item.text}>{item.text || '—'}</span>
        <span className="text-xs font-mono truncate" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>{item.session_id?.slice(0, 8)}…</span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.datetime ? absoluteTime(item.datetime) : '—'}</span>
        <span className="flex items-center justify-center">
          {expanded ? <ChevronUp size={13} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={13} style={{ color: 'var(--text-tertiary)' }} />}
        </span>
      </div>
      {expanded && (
        <div className="px-4 py-3 space-y-2" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Full prompt</div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.text}</p>
          <div className="text-xs font-mono mt-2" style={{ color: 'var(--text-tertiary)' }}>Session: {item.session_id}</div>
        </div>
      )}
    </>
  );
}

function HistoryTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [search]);

  const PAGE_SIZE = 50;
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.geminiMemory(page, debouncedSearch),
    queryFn: () => fetchGeminiMemory(page, PAGE_SIZE, debouncedSearch),
    staleTime: 60_000,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
      <div className="px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Search size={12} style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search history…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          {data && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{data.total} entries</span>}
        </div>
      </div>

      <div className="grid gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider flex-shrink-0" style={{ gridTemplateColumns: '3fr 1fr 1fr 24px', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
        <span>Prompt</span><span>Session</span><span>Date</span><span />
      </div>

      {isLoading && (
        <div className="flex-1 space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-28" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="flex-1 overflow-auto">
          {(!data || data.items.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <History size={32} style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {debouncedSearch ? 'No matching entries.' : 'No query history found.'}
              </p>
            </div>
          ) : (
            data.items.map((item, i) => <HistoryRow key={`${item.session_id}-${i}`} item={item} />)
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 transition-all">
              <ChevronLeft size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 transition-all">
              <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page shell ──────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'gemini-md', label: 'GEMINI.md', icon: FileText },
  { id: 'claude-memories', label: 'Claude Memories', icon: BookOpen },
  { id: 'history', label: 'Query History', icon: History },
];

export function GeminiMemoryPage() {
  const [tab, setTab] = useState<Tab>('gemini-md');

  return (
    <div className="p-6 flex flex-col h-full gap-5">
      <div className="flex items-center gap-3">
        <Database size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Gemini Memory</h1>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs transition-all"
            style={{
              color: tab === id ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {tab === 'gemini-md' && <GeminiMdTab />}
        {tab === 'claude-memories' && <ClaudeMemoriesTab />}
        {tab === 'history' && <HistoryTab />}
      </div>
    </div>
  );
}
