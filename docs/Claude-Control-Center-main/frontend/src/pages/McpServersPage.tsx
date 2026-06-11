import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { Server, Plus, Trash2, Pencil, X, ChevronDown, ArrowUpCircle } from 'lucide-react';
import {
  fetchMcpServers, createMcpServer, updateMcpServer, deleteMcpServer, promoteMcpServer,
} from '../api/mcpServers';
import { useProjects } from '../hooks/useProjects';
import { apiFetch } from '../api/client';
import type { McpServerConfig } from '../types';
import { McpInstallCard } from '../components/mcp/McpInstallCard';

const SCOPE_GLOBAL = '__global__';
const SERVER_TYPES = ['stdio', 'sse', 'http'] as const;

type ServerType = typeof SERVER_TYPES[number];

interface FormState {
  name: string;
  serverType: ServerType;
  command: string;
  args: string;
  env: string;
  url: string;
  headers: string;
}

const emptyForm = (): FormState => ({
  name: '', serverType: 'stdio', command: '', args: '', env: '', url: '', headers: '',
});

function parseKV(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  raw.split('\n').forEach((line) => {
    const eq = line.indexOf('=');
    if (eq > 0) out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  });
  return out;
}

function kvToString(obj: Record<string, string> = {}): string {
  return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n');
}

function serverToForm(s: McpServerConfig): FormState {
  const t: ServerType = (s.type as ServerType) || 'stdio';
  return {
    name: s.name,
    serverType: t,
    command: s.command || '',
    args: (s.args || []).join(' '),
    env: kvToString(s.env),
    url: s.url || '',
    headers: kvToString(s.headers),
  };
}

function formToPayload(f: FormState): Omit<McpServerConfig, 'name'> {
  if (f.serverType === 'stdio') {
    const payload: Omit<McpServerConfig, 'name'> = { command: f.command };
    if (f.args.trim()) payload.args = f.args.trim().split(/\s+/);
    const env = parseKV(f.env);
    if (Object.keys(env).length) payload.env = env;
    return payload;
  }
  const payload: Omit<McpServerConfig, 'name'> = { type: f.serverType, url: f.url };
  const headers = parseKV(f.headers);
  if (Object.keys(headers).length) payload.headers = headers;
  return payload;
}

export function McpServersPage() {
  const qc = useQueryClient();
  const [scope, setScope] = useState(SCOPE_GLOBAL);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<McpServerConfig | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await apiFetch('/api/mcp-servers/refresh-tool-counts');
      await qc.invalidateQueries({ queryKey: queryKeys.mcpServers() });
    } finally {
      setRefreshing(false);
    }
  }

  const projectId = scope === SCOPE_GLOBAL ? undefined : scope;
  const { data: projects } = useProjects();
  const { data: servers = [], isLoading } = useQuery({
    queryKey: queryKeys.mcpServers(scope),
    queryFn: () => fetchMcpServers(projectId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.mcpServers() });

  const createMut = useMutation({
    mutationFn: (f: FormState) =>
      createMcpServer({ name: f.name, ...formToPayload(f), projectId }),
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (e: Error) => setErr(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (f: FormState) => updateMcpServer(f.name, formToPayload(f), projectId),
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (e: Error) => setErr(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (name: string) => deleteMcpServer(name, projectId),
    onSuccess: invalidate,
  });

  const promoteMut = useMutation({
    mutationFn: ({ name, fromProject }: { name: string; fromProject: string }) =>
      promoteMcpServer(name, fromProject),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.mcpServers(SCOPE_GLOBAL) }),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setErr('');
    setModalOpen(true);
  }

  function openEdit(s: McpServerConfig) {
    setEditing(s);
    setForm(serverToForm(s));
    setErr('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSave() {
    setErr('');
    if (!form.name.trim()) { setErr('Name is required'); return; }
    if (form.serverType === 'stdio' && !form.command.trim()) { setErr('Command is required'); return; }
    if (form.serverType !== 'stdio' && !form.url.trim()) { setErr('URL is required'); return; }
    if (editing) updateMut.mutate(form);
    else createMut.mutate(form);
  }

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Server size={18} style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>MCP Servers</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-primary flex items-center gap-2 text-sm px-3 py-1.5" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh Tool Counts'}
          </button>
          <button className="btn-primary flex items-center gap-2 text-sm px-3 py-1.5" onClick={openCreate}>
            <Plus size={14} /> Add Server
          </button>
        </div>
      </div>

      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
          Memory MCP Bridge
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <McpInstallCard agent="claude" />
          <McpInstallCard agent="codex" />
          <McpInstallCard agent="gemini" />
        </div>
      </div>

      {/* Scope selector */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Scope:</span>
        <button
          className="chip transition-all"
          onClick={() => setScope(SCOPE_GLOBAL)}
          style={{
            background: scope === SCOPE_GLOBAL ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
            color: scope === SCOPE_GLOBAL ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          Global
        </button>
        {projects?.map((p) => (
          <button
            key={p.id}
            className="chip transition-all"
            onClick={() => setScope(p.id)}
            style={{
              background: scope === p.id ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
              color: scope === p.id ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            {p.displayName}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card p-4"><div className="skeleton h-5 w-48" /></div>)}
        </div>
      ) : servers.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No MCP servers configured</p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((s) => {
            const isStdio = !s.type || s.type === 'stdio';
            return (
              <div key={s.name} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {s.name}
                      </span>
                      <span className="chip" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                        {s.type || 'stdio'}
                      </span>
                      {s.toolCount != null ? (
                        <span className="chip">{s.toolCount} tools</span>
                      ) : (
                        <span className="chip" style={{ opacity: 0.4 }}>— tools</span>
                      )}
                    </div>
                    <p className="text-xs mt-1 font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                      {isStdio ? [s.command, ...(s.args || [])].join(' ') : s.url}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {projectId && (
                      <button
                        className="p-1.5 rounded transition-colors"
                        title="Promote to Global"
                        onClick={() => promoteMut.mutate({ name: s.name, fromProject: projectId })}
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        <ArrowUpCircle size={14} />
                      </button>
                    )}
                    <button
                      className="p-1.5 rounded transition-colors"
                      onClick={() => openEdit(s)}
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="p-1.5 rounded transition-colors"
                      onClick={() => deleteMut.mutate(s.name)}
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog.Root open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
              <Dialog.Title className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {editing ? 'Edit MCP Server' : 'Add MCP Server'}
              </Dialog.Title>
              <Dialog.Close className="p-1 rounded" style={{ color: 'var(--text-tertiary)' }}>
                <X size={16} />
              </Dialog.Close>
            </div>
            <div className="p-5 space-y-4">
              <label className="block">
                <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Name</span>
                <input
                  className="input w-full"
                  value={form.name}
                  disabled={!!editing}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="my-server"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Type</span>
                <select
                  className="input w-full"
                  value={form.serverType}
                  onChange={(e) => setForm((f) => ({ ...f, serverType: e.target.value as ServerType }))}
                >
                  {SERVER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              {form.serverType === 'stdio' ? (
                <>
                  <label className="block">
                    <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Command</span>
                    <input
                      className="input w-full font-mono"
                      value={form.command}
                      onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
                      placeholder="npx"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Args (space-separated)</span>
                    <input
                      className="input w-full font-mono"
                      value={form.args}
                      onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))}
                      placeholder="-y @some/mcp-server"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Env (KEY=VALUE, one per line)</span>
                    <textarea
                      className="input w-full font-mono text-xs"
                      rows={3}
                      value={form.env}
                      onChange={(e) => setForm((f) => ({ ...f, env: e.target.value }))}
                      placeholder="API_KEY=abc123"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="block">
                    <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>URL</span>
                    <input
                      className="input w-full font-mono"
                      value={form.url}
                      onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                      placeholder="https://example.com/mcp"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Headers (KEY=VALUE, one per line)</span>
                    <textarea
                      className="input w-full font-mono text-xs"
                      rows={3}
                      value={form.headers}
                      onChange={(e) => setForm((f) => ({ ...f, headers: e.target.value }))}
                      placeholder="Authorization=Bearer token"
                    />
                  </label>
                </>
              )}

              {err && <p className="text-xs" style={{ color: 'var(--error)' }}>{err}</p>}
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <Dialog.Close
                className="btn-secondary text-sm px-3 py-1.5"
                onClick={closeModal}
              >
                Cancel
              </Dialog.Close>
              <button
                className="btn-primary text-sm px-3 py-1.5"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Server'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
