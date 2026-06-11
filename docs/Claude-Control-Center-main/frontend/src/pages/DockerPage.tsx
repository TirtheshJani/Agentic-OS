import { useState } from 'react';
import {
  RefreshCw, Play, Square, RotateCcw, Rocket, ScrollText,
  ChevronDown, ChevronRight, Container,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  useDockerStacks,
  useStackDetail,
  useStackAction,
  useRedeployStack,
  useStackLogs,
} from '../hooks/useDocker';
import type { DockerActionResult } from '../types';

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const isRunning = s.includes('running') && !s.includes('exit');
  const isExited = s.includes('exit') || s === 'exited';
  const isPartial = isRunning && s.includes('(');

  const color = isPartial
    ? 'var(--orange-500)'
    : isRunning
    ? 'var(--green-500)'
    : isExited
    ? 'var(--ds-neutral-500)'
    : 'var(--ds-neutral-500)';

  return (
    <span
      className="chip"
      style={{
        background: `color-mix(in oklab, ${color} 15%, transparent)`,
        color,
        border: `1px solid color-mix(in oklab, ${color} 30%, transparent)`,
        fontSize: '11px',
        padding: '2px 8px',
      }}
    >
      {status || 'unknown'}
    </span>
  );
}

function ResultPanel({ result }: { result: DockerActionResult }) {
  const ok = result.returncode === 0;
  return (
    <div
      style={{
        marginTop: 8,
        padding: '10px 12px',
        borderRadius: 4,
        background: ok
          ? 'color-mix(in oklab, var(--green-500) 8%, transparent)'
          : 'color-mix(in oklab, var(--red-500, #ef4444) 10%, transparent)',
        border: `1px solid color-mix(in oklab, ${ok ? 'var(--green-500)' : 'var(--red-500, #ef4444)'} 25%, transparent)`,
        fontFamily: 'var(--font-mono-ds)',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        maxHeight: 240,
        overflowY: 'auto',
      }}
    >
      {result.stdout || result.stderr || (ok ? 'Done.' : 'Failed with no output.')}
    </div>
  );
}

function LogPanel({ name }: { name: string }) {
  const [fetchEnabled, setFetchEnabled] = useState(false);
  const { data, isFetching, refetch } = useStackLogs(name, 200, fetchEnabled);

  if (!fetchEnabled) {
    return (
      <button
        className="btn-primary"
        style={{ fontSize: '12px', padding: '4px 12px', marginTop: 8 }}
        onClick={() => setFetchEnabled(true)}
      >
        <ScrollText size={13} /> View Logs
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Last 200 lines
        </span>
        <button
          className="btn-primary"
          style={{ fontSize: '11px', padding: '2px 8px' }}
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw size={11} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>
      <pre
        style={{
          background: 'var(--surface-2, #0d1117)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '10px 12px',
          fontFamily: 'var(--font-mono-ds)',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: 320,
          margin: 0,
          whiteSpace: 'pre',
        }}
      >
        {isFetching ? 'Loading…' : data?.logs || data?.stderr || '(no output)'}
      </pre>
    </div>
  );
}

function StackCard({ name, status, configFiles }: { name: string; status: string; configFiles: string }) {
  const [expanded, setExpanded] = useState(false);
  const [actionResult, setActionResult] = useState<DockerActionResult | null>(null);

  const { data: detail, isFetching: loadingDetail } = useStackDetail(expanded ? name : null);
  const { mutate: doAction, isPending: actionPending } = useStackAction();
  const { mutate: doRedeploy, isPending: redeployPending } = useRedeployStack();

  const busy = actionPending || redeployPending;

  function handleAction(action: 'start' | 'stop' | 'restart') {
    setActionResult(null);
    doAction({ name, action }, { onSuccess: (res) => setActionResult(res ?? null) });
  }

  function handleRedeploy() {
    setActionResult(null);
    doRedeploy(name, { onSuccess: (res) => setActionResult(res ?? null) });
  }

  return (
    <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, display: 'flex' }}
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <Container size={15} style={{ color: 'var(--blue-500, #3b82f6)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', flex: 1 }}>
          {name}
        </span>
        <StatusBadge status={status} />
      </div>

      {/* Config path */}
      <div style={{ marginLeft: 50, marginTop: 4, fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono-ds)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {configFiles}
      </div>

      {/* Action buttons */}
      <div style={{ marginLeft: 50, marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn-primary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => handleAction('start')} disabled={busy}>
          <Play size={12} /> Start
        </button>
        <button className="btn-primary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => handleAction('stop')} disabled={busy}>
          <Square size={12} /> Stop
        </button>
        <button className="btn-primary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => handleAction('restart')} disabled={busy}>
          <RotateCcw size={12} /> Restart
        </button>
        <button
          className="btn-primary"
          style={{ fontSize: '12px', padding: '4px 10px', background: redeployPending ? undefined : 'color-mix(in oklab, var(--orange-500) 20%, transparent)', color: 'var(--orange-500)' }}
          onClick={handleRedeploy}
          disabled={busy}
        >
          <Rocket size={12} /> {redeployPending ? 'Deploying…' : 'Redeploy'}
        </button>
      </div>

      {/* Action result */}
      {actionResult && (
        <div style={{ marginLeft: 50 }}>
          <ResultPanel result={actionResult} />
        </div>
      )}

      {/* Expanded: services table + logs */}
      {expanded && (
        <div style={{ marginLeft: 50, marginTop: 12 }}>
          {loadingDetail ? (
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Loading services…</div>
          ) : detail?.services && detail.services.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px' }}>Service</th>
                  <th style={{ padding: '4px 8px' }}>State</th>
                  <th style={{ padding: '4px 8px' }}>Status</th>
                  <th style={{ padding: '4px 8px' }}>Ports</th>
                </tr>
              </thead>
              <tbody>
                {detail.services.map((svc) => (
                  <tr key={svc.name} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono-ds)', color: 'var(--text-primary)' }}>{svc.service}</td>
                    <td style={{ padding: '5px 8px' }}>
                      <StatusBadge status={svc.state} />
                    </td>
                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono-ds)', fontSize: '11px' }}>{svc.status}</td>
                    <td style={{ padding: '5px 8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono-ds)', fontSize: '11px' }}>{svc.ports || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>No services found (stack may be stopped).</div>
          )}

          <LogPanel name={name} />
        </div>
      )}
    </div>
  );
}

export function DockerPage() {
  const { data: stacks, isFetching, refetch } = useDockerStacks();

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Container size={20} style={{ color: 'var(--blue-500, #3b82f6)' }} />
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Docker Stacks
        </h1>
        <button
          className="btn-primary"
          style={{ marginLeft: 'auto', fontSize: '12px', padding: '5px 12px' }}
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw size={13} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Stack list */}
      {isFetching && (!stacks || stacks.length === 0) ? (
        <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Loading stacks…</div>
      ) : !stacks || stacks.length === 0 ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
          No docker-compose stacks detected. Make sure Docker is running and at least one compose project exists.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stacks.map((stack) => (
            <StackCard key={stack.name} {...stack} />
          ))}
        </div>
      )}
    </div>
  );
}
