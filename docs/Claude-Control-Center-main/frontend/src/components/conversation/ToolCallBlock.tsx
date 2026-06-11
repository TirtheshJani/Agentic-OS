import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ContentBlock } from '../../types';

const TOOL_COLORS: Record<string, { bg: string; text: string }> = {
  Bash:          { bg: 'rgba(249,115,22,0.12)', text: '#fb923c' },
  Read:          { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa' },
  Write:         { bg: 'rgba(34,197,94,0.12)',  text: '#4ade80' },
  Edit:          { bg: 'rgba(234,179,8,0.12)',  text: '#facc15' },
  Grep:          { bg: 'rgba(168,85,247,0.12)', text: '#c084fc' },
  Glob:          { bg: 'rgba(168,85,247,0.12)', text: '#c084fc' },
  Agent:         { bg: 'var(--accent-dim)', text: 'var(--accent)' },
  advisor:       { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24' },
  WebFetch:      { bg: 'rgba(20,184,166,0.12)', text: '#2dd4bf' },
  WebSearch:     { bg: 'rgba(20,184,166,0.12)', text: '#2dd4bf' },
  TodoWrite:     { bg: 'rgba(244,63,94,0.12)',  text: '#fb7185' },
  default:       { bg: 'rgba(255,255,255,0.06)', text: '#8b949e' },
};

function getToolColor(name: string) {
  return TOOL_COLORS[name] ?? TOOL_COLORS.default;
}

function getInputPreview(input: unknown): string {
  if (!input) return '';
  if (typeof input === 'string') return input.slice(0, 80);
  const obj = input as Record<string, unknown>;
  const firstVal = Object.values(obj)[0];
  if (typeof firstVal === 'string') return firstVal.slice(0, 80);
  return JSON.stringify(input).slice(0, 80);
}

function getResultText(content: string | ContentBlock[] | undefined): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content.map((b) => (b.type === 'text' ? b.text ?? '' : '')).join('');
}

interface Props {
  toolBlock: ContentBlock;
  resultBlock?: ContentBlock;
  onOpenSubagent?: (agentId: string) => void;
}

export function ToolCallBlock({ toolBlock, resultBlock, onOpenSubagent }: Props) {
  const isAdvisor = toolBlock.type === 'server_tool_use' && toolBlock.name === 'advisor';
  const name = isAdvisor ? 'Advisor' : (toolBlock.name ?? 'Unknown');
  const inputStr = isAdvisor ? '(advisor consulted)' : (JSON.stringify(toolBlock.input, null, 2) ?? '');
  const resultStr = getResultText(resultBlock?.content);
  const isError = resultBlock?.is_error || !!resultBlock?.error;

  const isLong = inputStr.length > 200 || resultStr.length > 300;
  const [expanded, setExpanded] = useState(!isLong);
  const [tab, setTab] = useState<'input' | 'output'>('input');

  const { bg, text } = getToolColor(isAdvisor ? 'advisor' : name);
  const inputPreview = isAdvisor ? 'Consulting advisor...' : getInputPreview(toolBlock.input);

  const isAgentTool = name === 'Agent';
  // Try to extract agentId from the result or input
  const agentId = (() => {
    if (!isAgentTool) return null;
    const id = (toolBlock.input as Record<string, unknown>)?.subagent_id;
    return typeof id === 'string' ? id : null;
  })();

  return (
    <div
      className="rounded-lg overflow-hidden text-xs"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${isError ? 'rgba(248,81,73,0.3)' : 'var(--border)'}`,
        marginTop: '6px',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors"
      >
        {expanded ? (
          <ChevronDown size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        ) : (
          <ChevronRight size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        )}
        <span className="chip font-mono" style={{ background: bg, color: text }}>
          {name}
        </span>
        {!expanded && (
          <span className="truncate font-mono" style={{ color: 'var(--text-secondary)' }}>
            {inputPreview}
          </span>
        )}
        {isError && (
          <span className="chip ml-auto" style={{ background: 'rgba(248,81,73,0.12)', color: '#f85149' }}>
            error
          </span>
        )}
        {isAgentTool && agentId && onOpenSubagent && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenSubagent(agentId); }}
            className="chip ml-auto hover:opacity-80 transition-opacity"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            View Agent →
          </button>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {/* Tabs */}
          <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
            {(['input', 'output'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                  tab === t
                    ? 'border-b-2 border-accent'
                    : 'hover:bg-white/[0.03]'
                )}
                style={{ color: tab === t ? 'var(--accent)' : 'var(--text-secondary)' }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="max-h-64 overflow-auto">
            {tab === 'input' ? (
              <pre className="p-3 font-mono text-xs whitespace-pre-wrap break-all"
                style={{ color: '#c9d1d9', margin: 0 }}>
                {inputStr}
              </pre>
            ) : (
              <pre
                className="p-3 font-mono text-xs whitespace-pre-wrap break-all"
                style={{
                  color: isError ? '#f85149' : '#c9d1d9',
                  margin: 0,
                }}
              >
                {resultStr || '(no output)'}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
