import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, X, Loader2, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { useGwsStream } from '../../hooks/useGwsStream';

const ALLOWED_SERVICES = [
  'gmail', 'drive', 'calendar', 'sheets', 'docs', 'chat', 'tasks',
  'people', 'forms', 'keep', 'slides', 'classroom', 'meet', 'script',
  'workflow', 'admin-reports', 'events', 'modelarmor', 'schema',
];

const HISTORY_KEY = 'gws-shell-history';
const MAX_HISTORY = 100;

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); } catch { return []; }
}

function saveHistory(h: string[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-MAX_HISTORY)));
}

interface ShellLine {
  type: 'cmd' | 'out' | 'err' | 'info';
  text: string;
}

export function ShellTab() {
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<ShellLine[]>([
    { type: 'info', text: 'gws shell — type a command and press Enter, e.g.  calendar +agenda  or  gmail +triage' },
    { type: 'info', text: `Services: ${ALLOWED_SERVICES.join(', ')}` },
  ]);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { lines: streamLines, running, error, start, stop } = useGwsStream();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, streamLines]);

  // Mirror stream output into shell lines
  useEffect(() => {
    if (streamLines.length === 0) return;
    const last = streamLines[streamLines.length - 1];
    setLines((prev) => {
      const existing = prev[prev.length - 1];
      if (existing?.text === last.text && existing?.type === 'out') return prev;
      return [...prev, { type: last.type, text: last.text }];
    });
  }, [streamLines]);

  useEffect(() => {
    if (!running && error) {
      setLines((prev) => [...prev, { type: 'err', text: error }]);
    }
  }, [running, error]);

  const parseArgs = (raw: string): string[] => {
    const args: string[] = [];
    let cur = '';
    let inQ = false;
    let qChar = '';
    for (const ch of raw) {
      if (inQ) {
        if (ch === qChar) { inQ = false; } else { cur += ch; }
      } else if (ch === '"' || ch === "'") {
        inQ = true; qChar = ch;
      } else if (ch === ' ') {
        if (cur) { args.push(cur); cur = ''; }
      } else { cur += ch; }
    }
    if (cur) args.push(cur);
    return args;
  };

  const run = useCallback(() => {
    const raw = input.trim();
    if (!raw || running) return;

    const args = parseArgs(raw);
    if (!args.length) return;

    setLines((prev) => [...prev, { type: 'cmd', text: `$ gws ${raw}` }]);
    setInput('');
    setHistIdx(-1);

    const newHistory = [raw, ...history.filter((h) => h !== raw)];
    setHistory(newHistory);
    saveHistory(newHistory);

    if (!ALLOWED_SERVICES.includes(args[0])) {
      setLines((prev) => [
        ...prev,
        { type: 'err', text: `Unknown service '${args[0]}'. Allowed: ${ALLOWED_SERVICES.join(', ')}` },
      ]);
      return;
    }

    start(args, 'manual');
  }, [input, running, history, start]);

  // Sync completed stream with done marker
  useEffect(() => {
    if (!running && streamLines.length > 0) {
      setLines((prev) => {
        const last = prev[prev.length - 1];
        if (last?.text === '✓ Done') return prev;
        return [...prev, { type: 'info', text: '✓ Done' }];
      });
    }
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      run();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next);
      setInput(history[next] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next);
      setInput(next === -1 ? '' : (history[next] ?? ''));
    } else if (e.key === 'c' && e.ctrlKey) {
      if (running) { stop(); setLines((prev) => [...prev, { type: 'err', text: '^C' }]); }
    }
  };

  const lineColor = (t: ShellLine['type']) => {
    if (t === 'cmd') return 'var(--accent)';
    if (t === 'err') return '#f87171';
    if (t === 'info') return 'var(--text-tertiary)';
    return 'var(--text-primary)';
  };

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'var(--font-mono, ui-monospace, monospace)' }}>
      <div
        className="flex-1 overflow-y-auto p-4 text-xs"
        style={{ background: 'var(--bg-code)' }}
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((l, i) => (
          <div key={i} style={{ color: lineColor(l.type), whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6 }}>
            {l.text || ' '}
          </div>
        ))}
        {running && (
          <div className="flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            <Loader2 size={10} className="animate-spin" />
            <span>running…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}
      >
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--accent)', userSelect: 'none' }}>$ gws</span>
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: 'var(--text-primary)', caretColor: 'var(--accent)', fontFamily: 'inherit' }}
          value={input}
          onChange={(e) => { setInput(e.target.value); setHistIdx(-1); }}
          onKeyDown={handleKeyDown}
          placeholder="calendar +agenda"
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="btn-ghost p-1"
            title="Previous (↑)"
            onClick={() => {
              const next = Math.min(histIdx + 1, history.length - 1);
              setHistIdx(next); setInput(history[next] ?? '');
            }}
            disabled={!history.length}
          >
            <ChevronUp size={12} />
          </button>
          <button
            className="btn-ghost p-1"
            title="Next (↓)"
            onClick={() => {
              const next = Math.max(histIdx - 1, -1);
              setHistIdx(next); setInput(next === -1 ? '' : (history[next] ?? ''));
            }}
          >
            <ChevronDown size={12} />
          </button>
          <button
            className="btn-ghost p-1"
            title="Clear output"
            onClick={() => setLines([{ type: 'info', text: 'gws shell — cleared' }])}
          >
            <Trash2 size={12} />
          </button>
          <button
            className="btn-primary text-xs px-3 py-1 flex items-center gap-1.5 disabled:opacity-50"
            onClick={running ? stop : run}
            disabled={!running && !input.trim()}
          >
            {running ? <><X size={11} /> Stop</> : <><Play size={11} /> Run</>}
          </button>
        </div>
      </div>
    </div>
  );
}
