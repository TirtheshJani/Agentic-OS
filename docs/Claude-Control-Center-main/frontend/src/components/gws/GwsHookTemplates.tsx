import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Download, Trash2, Clock, Mail } from 'lucide-react';
import { fetchGwsStatus } from '../../api/gws';
import { fetchHooks, createHook, deleteHook } from '../../api/hooks';
import type { HookEvent, HooksData } from '../../types';
import { queryKeys } from '../../lib/queryKeys';

const DEFAULT_PORT = 5050;

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

interface Template {
  id: string;
  name: string;
  description: string;
  event: HookEvent;
  matcher: string;
  buildCommand: (port: number) => string;
  /** Substring that must appear in an installed command to count as "this template" */
  fingerprint: string;
  icon: React.ElementType;
  warning?: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'standup-report',
    name: 'Morning Standup',
    description:
      "After each Claude Code session ends (Stop event), runs gws 'workflow +standup-report' if the local hour is between 06:00 and 10:00. Fires at most once per morning.",
    event: 'Stop',
    matcher: '*',
    buildCommand: (port) =>
      `bash -c 'h=$(date +%H); [ "$h" -ge 6 ] && [ "$h" -lt 10 ] && curl -s -X POST -H "X-Requested-With: XMLHttpRequest" -H "Content-Type: application/json" -d '"'"'{"args":["workflow","+standup-report"],"source":"hook"}'"'"' http://localhost:${port}/api/gws/execute'`,
    fingerprint: '+standup-report',
    icon: Clock,
  },
  {
    id: 'session-notification',
    name: 'Session Notification Email',
    description:
      "Sends a Gmail message to yourself when Claude Code emits a Notification event (e.g. a long task completed). Uses 'gws gmail +send' via the GWS executor.",
    event: 'Notification',
    matcher: '*',
    buildCommand: (port) =>
      `curl -s -X POST -H "X-Requested-With: XMLHttpRequest" -H "Content-Type: application/json" -d '{"args":["gmail","+send","--to","me","--subject","Claude Code notification","--body","A Claude Code session event occurred."],"source":"hook"}' http://localhost:${port}/api/gws/execute`,
    fingerprint: 'gmail","+send',
    icon: Mail,
  },
];

// ---------------------------------------------------------------------------
// Helper: find installed index
// ---------------------------------------------------------------------------

function findInstalled(
  hooksData: HooksData | undefined,
  template: Template,
): { found: boolean; index: number } {
  if (!hooksData) return { found: false, index: -1 };
  const entries = hooksData[template.event] ?? [];
  const index = entries.findIndex((e) =>
    e.hooks.some((h) => h.command.includes(template.fingerprint)),
  );
  return { found: index !== -1, index };
}

// ---------------------------------------------------------------------------
// Template card
// ---------------------------------------------------------------------------

function TemplateCard({
  template,
  hooksData,
  port,
}: {
  template: Template;
  hooksData: HooksData | undefined;
  port: number;
}) {
  const qc = useQueryClient();
  const { found, index } = findInstalled(hooksData, template);
  const Icon = template.icon;
  const nonDefault = port !== DEFAULT_PORT;

  const installMut = useMutation({
    mutationFn: () =>
      createHook(template.event, {
        matcher: template.matcher,
        command: template.buildCommand(port),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.hooks() }),
  });

  const removeMut = useMutation({
    mutationFn: () => deleteHook(template.event, index),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.hooks() }),
  });

  const busy = installMut.isPending || removeMut.isPending;

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded flex-shrink-0"
          style={{ background: 'var(--bg-secondary)', color: 'var(--accent)' }}
        >
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {template.name}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-tertiary)',
              }}
            >
              {template.event}
            </span>
            {found ? (
              <span
                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'var(--success-dim)', color: 'var(--success)' }}
              >
                <CheckCircle size={10} /> Active
              </span>
            ) : (
              <span
                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}
              >
                Not installed
              </span>
            )}
          </div>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {template.description}
          </p>
        </div>
      </div>

      {/* Command preview */}
      <div
        className="rounded p-2 font-mono text-xs overflow-x-auto"
        style={{ background: 'var(--bg-code)', color: 'var(--text-secondary)', whiteSpace: 'pre' }}
      >
        {template.buildCommand(port)}
      </div>

      {/* Warnings */}
      {nonDefault && (
        <div
          className="flex items-center gap-2 text-xs px-3 py-2 rounded"
          style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)', color: '#fb923c' }}
        >
          <AlertCircle size={12} />
          Port {port} detected (non-default). The command above already uses port {port}.
        </div>
      )}
      {installMut.isError && (
        <div className="text-xs" style={{ color: '#f87171' }}>
          Install failed: {(installMut.error as Error).message}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {found ? (
          <button
            className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
            onClick={() => removeMut.mutate()}
            disabled={busy}
            style={{ color: '#f87171' }}
          >
            <Trash2 size={12} />
            {removeMut.isPending ? 'Removing…' : 'Remove'}
          </button>
        ) : (
          <button
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
            onClick={() => installMut.mutate()}
            disabled={busy}
          >
            <Download size={12} />
            {installMut.isPending ? 'Installing…' : 'Install'}
          </button>
        )}
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Installs to global hooks · matcher: <code>{template.matcher}</code>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function GwsHookTemplates() {
  const { data: status } = useQuery({
    queryKey: queryKeys.gwsStatus(),
    queryFn: fetchGwsStatus,
    staleTime: 60_000,
  });

  // Always fetch global scope hooks so we can detect installed state
  const { data: hooksData } = useQuery({
    queryKey: queryKeys.hooks('__global__'),
    queryFn: () => fetchHooks(undefined),
    staleTime: 10_000,
  });

  const port = status?.port ?? DEFAULT_PORT;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 px-4 py-3 rounded" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <AlertCircle size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
        <div className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          These templates install global Claude Code hooks that call the GWS executor at{' '}
          <code>http://localhost:{port}/api/gws/execute</code>. The Claude Code process must be able
          to reach the Control Center on that port. Hooks are written to{' '}
          <code>~/.claude/settings.json</code>.
        </div>
      </div>

      {TEMPLATES.map((t) => (
        <TemplateCard key={t.id} template={t} hooksData={hooksData} port={port} />
      ))}
    </div>
  );
}
