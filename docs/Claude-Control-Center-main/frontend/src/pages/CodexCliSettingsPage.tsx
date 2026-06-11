import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { SlidersHorizontal, ShieldCheck, ShieldOff, CheckCircle, XCircle } from 'lucide-react';
import {
  fetchCodexAuthStatus,
  fetchCodexConfig,
  fetchCodexVersion,
  fetchCodexModels,
  updateCodexConfig,
} from '../api/codexCliSettings';
import { absoluteTime } from '../lib/utils';

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
      {title}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{value}</span>
    </div>
  );
}

function AuthSection() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.codexCliAuth(),
    queryFn: fetchCodexAuthStatus,
    staleTime: 60_000,
  });

  return (
    <div className="card px-4 py-3">
      <SectionHeader title="Authentication" />
      {isLoading && <div className="skeleton h-20 rounded" />}
      {data && (
        data.present ? (
          <div>
            <MetaRow label="Auth mode" value={data.auth_mode || '—'} />
            <MetaRow
              label="ID token"
              value={data.has_id_token
                ? <CheckCircle size={13} style={{ color: 'var(--success)' }} />
                : <XCircle size={13} style={{ color: '#f85149' }} />}
            />
            <MetaRow
              label="Refresh token"
              value={data.has_refresh_token
                ? <CheckCircle size={13} style={{ color: 'var(--success)' }} />
                : <XCircle size={13} style={{ color: '#f85149' }} />}
            />
            {data.last_refresh && (
              <MetaRow label="Last refreshed" value={absoluteTime(data.last_refresh)} />
            )}
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>auth.json not found — not authenticated.</p>
        )
      )}
    </div>
  );
}

function VersionSection() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.codexCliVersion(),
    queryFn: fetchCodexVersion,
    staleTime: 60_000,
  });

  return (
    <div className="card px-4 py-3">
      <SectionHeader title="Version" />
      {isLoading && <div className="skeleton h-16 rounded" />}
      {data && (
        <>
          <MetaRow label="Latest version" value={data.latest_version} />
          {data.last_checked_at && (
            <MetaRow label="Last checked" value={absoluteTime(data.last_checked_at)} />
          )}
          {data.dismissed_version && (
            <MetaRow label="Dismissed version" value={data.dismissed_version} />
          )}
        </>
      )}
    </div>
  );
}

function ModelsSection() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.codexCliModels(),
    queryFn: fetchCodexModels,
    staleTime: 60_000,
  });

  return (
    <div className="card px-4 py-3">
      <SectionHeader title="Available Models" />
      {data?.fetched_at && (
        <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
          Cached at {absoluteTime(data.fetched_at)}
        </p>
      )}
      {isLoading && <div className="skeleton h-20 rounded" />}
      {data && data.models.length > 0 && (
        <div
          className="overflow-hidden rounded-md"
          style={{ border: '1px solid var(--border)' }}
        >
          <div
            className="grid text-xs font-medium uppercase tracking-wider px-3 py-2"
            style={{
              gridTemplateColumns: '1fr 1fr 100px 80px',
              color: 'var(--text-tertiary)',
              background: 'rgba(255,255,255,0.02)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span>ID</span><span>Display Name</span><span>Context</span><span>Instructions</span>
          </div>
          {data.models.map((m) => (
            <div
              key={m.id}
              className="grid text-xs px-3 py-2"
              style={{
                gridTemplateColumns: '1fr 1fr 100px 80px',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              <span className="font-mono truncate">{m.id}</span>
              <span className="truncate">{m.display_name}</span>
              <span className="font-mono">{m.context_window ? `${(m.context_window / 1000).toFixed(0)}k` : '—'}</span>
              <span>{m.has_base_instructions ? <CheckCircle size={12} style={{ color: 'var(--success)' }} /> : '—'}</span>
            </div>
          ))}
        </div>
      )}
      {!isLoading && data?.models.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No models found in cache.</p>
      )}
    </div>
  );
}

function ConfigSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.codexCliConfig(),
    queryFn: fetchCodexConfig,
    staleTime: 60_000,
  });

  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: ({ path, trust_level }: { path: string; trust_level: string }) =>
      updateCodexConfig(path, trust_level),
    onSuccess: (_, vars) => {
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[vars.path];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.codexCliConfig() });
    },
  });

  const projects = data?.projects ?? [];

  return (
    <div className="card px-4 py-3">
      <SectionHeader title="Project Trust Configuration" />
      {isLoading && <div className="skeleton h-24 rounded" />}
      {!isLoading && projects.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No project entries in config.toml.</p>
      )}
      {projects.length > 0 && (
        <div className="space-y-2">
          {projects.map((p) => {
            const current = pendingChanges[p.path] ?? p.trust_level;
            const changed = current !== p.trust_level;
            return (
              <div
                key={p.path}
                className="flex items-center gap-3 py-2 px-3 rounded-md"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}
              >
                {current === 'trusted'
                  ? <ShieldCheck size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  : <ShieldOff size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                }
                <span className="flex-1 text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }} title={p.path}>
                  {p.path}
                </span>
                <select
                  value={current}
                  onChange={(e) => setPendingChanges((prev) => ({ ...prev, [p.path]: e.target.value }))}
                  className="text-xs rounded px-2 py-1"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    outline: 'none',
                  }}
                >
                  <option value="trusted">trusted</option>
                  <option value="untrusted">untrusted</option>
                </select>
                {changed && (
                  <button
                    onClick={() => save({ path: p.path, trust_level: current })}
                    disabled={saving}
                    className="text-xs px-2 py-1 rounded-md transition-all hover:opacity-80 disabled:opacity-40"
                    style={{ background: 'var(--accent)', color: '#000', fontWeight: 600 }}
                  >
                    Save
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CodexCliSettingsPage() {
  return (
    <div className="p-6 flex flex-col h-full gap-5 overflow-auto">
      <div className="flex items-center gap-3">
        <SlidersHorizontal size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Codex Settings</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AuthSection />
        <VersionSection />
      </div>

      <ModelsSection />
      <ConfigSection />
    </div>
  );
}
