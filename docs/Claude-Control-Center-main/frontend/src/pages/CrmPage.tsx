import { useEffect, useMemo, useState } from 'react';
import {
  Users, Plus, RefreshCw, AlertCircle, Loader2, CheckCircle2, Pencil, X, LayoutGrid,
} from 'lucide-react';
import {
  useCrmConfig,
  useClients,
  useSetupCrm,
  useCreateClient,
  useUpdateClient,
} from '../hooks/useCrm';
import type { Client, ClientInput, ClientStatus, ClientType } from '../api/crm';
import { ApiError } from '../api/client';
import { PipelineBoard } from '../components/crm/PipelineBoard';

type CrmTab = 'clients' | 'pipeline';

const errMsg = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : String(e));

const STATUS_STYLE: Record<ClientStatus, { bg: string; fg: string }> = {
  prospect: { bg: 'rgba(245,166,35,0.15)', fg: 'var(--warning, #f5a623)' },
  active: { bg: 'rgba(46,160,67,0.15)', fg: 'var(--success, #2ea043)' },
  churned: { bg: 'rgba(229,72,77,0.12)', fg: 'var(--danger, #e5484d)' },
};

// Fall back gracefully for any unexpected status value so a single bad row
// can't white-screen the whole table.
const statusStyle = (status: string) =>
  STATUS_STYLE[status as ClientStatus] ?? { bg: 'var(--bg-tertiary, rgba(255,255,255,0.06))', fg: 'var(--text-tertiary)' };

const TYPE_LABEL: Record<ClientType, string> = { US: 'US · USD', ON: 'Ontario · CAD+HST' };

const emptyForm: ClientInput = {
  name: '', company: '', type: 'US', email: '', sector: '', status: 'prospect', notes: '',
};

export function CrmPage() {
  const { data: config, isLoading: configLoading } = useCrmConfig();
  const clientsQuery = useClients();
  const setupMutation = useSetupCrm();
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();

  const [form, setForm] = useState<ClientInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [setupResult, setSetupResult] = useState<string | null>(null);
  const [tab, setTab] = useState<CrmTab>('clients');

  const configured = config?.configured ?? false;

  // type drives currency + HST defaults; mirror the backend so the form previews them.
  const derived = useMemo(() => {
    if (form.currency || form.hst_applicable != null) {
      return { currency: form.currency, hst: form.hst_applicable };
    }
    return form.type === 'ON'
      ? { currency: 'CAD', hst: true }
      : { currency: 'USD', hst: false };
  }, [form.type, form.currency, form.hst_applicable]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(c: Client) {
    setEditingId(c.client_id);
    setForm({
      name: c.name, company: c.company, type: c.type, currency: c.currency,
      hst_applicable: c.hst_applicable, email: c.email, sector: c.sector,
      status: c.status, notes: c.notes,
    });
  }

  // From a pipeline deal card: jump to the Clients tab and open that client for edit.
  function openClientFromDeal(clientId: string) {
    const c = clientsQuery.data?.clients.find((x) => x.client_id === clientId);
    setTab('clients');
    if (c) startEdit(c);
  }

  async function handleSubmit() {
    if (!form.name.trim()) return;
    if (editingId) {
      await updateMutation.mutateAsync({ clientId: editingId, input: form });
    } else {
      await createMutation.mutateAsync(form);
    }
    resetForm();
  }

  const submitting = createMutation.isPending || updateMutation.isPending;
  const submitError = createMutation.error || updateMutation.error;

  if (configLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        <Loader2 size={14} className="animate-spin" /> Loading CRM…
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-1">
        <Users size={20} style={{ color: 'var(--text-primary)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>CRM</h1>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        Your client spine and deal pipeline, backed by a Google Sheet. Client type sets billing defaults — US bills
        in USD (no HST), Ontario bills in CAD with 13% HST.
      </p>

      {configured && (
        <div className="flex items-center gap-1 mb-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <TabButton active={tab === 'clients'} onClick={() => setTab('clients')} icon={<Users size={14} />} label="Clients" />
          <TabButton active={tab === 'pipeline'} onClick={() => setTab('pipeline')} icon={<LayoutGrid size={14} />} label="Pipeline" />
        </div>
      )}

      {!configured && (
        <div className="card mb-5" style={{ padding: '16px' }}>
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            No CRM spreadsheet configured
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Create a Google Sheet (with Clients + Deals tabs) to store your CRM data. After it's created,
            add its id as <code>CRM_SHEET_ID</code> in <code>backend/.env</code> and restart the backend.
          </p>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={async () => {
              const res = await setupMutation.mutateAsync(undefined);
              setSetupResult(res.spreadsheet_id);
            }}
            disabled={setupMutation.isPending}
          >
            {setupMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create CRM spreadsheet
          </button>
          {setupMutation.isError && (
            <div className="text-sm flex items-start gap-2 mt-3" style={{ color: 'var(--danger, #e5484d)' }}>
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {errMsg(setupMutation.error)}
            </div>
          )}
          {setupResult && (
            <div className="card mt-3" style={{ padding: '12px 14px', background: 'rgba(46,160,67,0.08)' }}>
              <div className="flex items-center gap-2 text-sm font-semibold mb-1" style={{ color: 'var(--success, #2ea043)' }}>
                <CheckCircle2 size={15} /> Spreadsheet created
              </div>
              <div className="text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>
                CRM_SHEET_ID={setupResult}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                Add this to <code>backend/.env</code> and restart the backend to start adding clients.
              </div>
            </div>
          )}
        </div>
      )}

      {configured && tab === 'pipeline' && (
        <PipelineBoard
          clients={clientsQuery.data?.clients ?? []}
          onOpenClient={openClientFromDeal}
        />
      )}

      {configured && tab === 'clients' && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(280px, 360px) 1fr' }}>
          {/* Left: create / edit form */}
          <div className="card" style={{ padding: '16px' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {editingId ? 'Edit client' : 'New client'}
              </div>
              {editingId && (
                <button className="text-xs flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }} onClick={resetForm}>
                  <X size={12} /> Cancel
                </button>
              )}
            </div>

            <Field label="Name *">
              <input className="input-field w-full text-sm" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contact / client name" />
            </Field>
            <Field label="Company">
              <input className="input-field w-full text-sm" value={form.company ?? ''}
                onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select className="input-field w-full text-sm" value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as ClientType, currency: undefined, hst_applicable: undefined })}>
                  <option value="US">US (USD)</option>
                  <option value="ON">Ontario (CAD+HST)</option>
                </select>
              </Field>
              <Field label="Status">
                <select className="input-field w-full text-sm" value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ClientStatus })}>
                  <option value="prospect">Prospect</option>
                  <option value="active">Active</option>
                  <option value="churned">Churned</option>
                </select>
              </Field>
            </div>

            <div className="text-xs mb-3 -mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Billing: {derived.currency}{derived.hst ? ' · 13% HST' : ' · no HST'}
            </div>

            <Field label="Email">
              <input className="input-field w-full text-sm" value={form.email ?? ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Sector">
              <input className="input-field w-full text-sm" value={form.sector ?? ''}
                onChange={(e) => setForm({ ...form, sector: e.target.value })} placeholder="e.g. retail, healthcare" />
            </Field>
            <Field label="Notes">
              <textarea className="input-field w-full text-sm" rows={3} value={form.notes ?? ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>

            <button className="btn-primary flex items-center gap-2 mt-1" onClick={handleSubmit} disabled={submitting || !form.name.trim()}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : editingId ? <Pencil size={14} /> : <Plus size={14} />}
              {editingId ? 'Save changes' : 'Add client'}
            </button>

            {submitError && (
              <div className="text-sm flex items-start gap-2 mt-3" style={{ color: 'var(--danger, #e5484d)' }}>
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {errMsg(submitError)}
              </div>
            )}
          </div>

          {/* Right: client table */}
          <div className="card" style={{ padding: '16px' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {clientsQuery.data?.clients.length ?? 0} clients
              </div>
              <button className="text-xs flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}
                onClick={() => clientsQuery.refetch()} disabled={clientsQuery.isFetching}>
                <RefreshCw size={12} className={clientsQuery.isFetching ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            {clientsQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm py-8" style={{ color: 'var(--text-tertiary)' }}>
                <Loader2 size={14} className="animate-spin" /> Loading clients…
              </div>
            )}
            {clientsQuery.isError && (
              <div className="text-sm flex items-start gap-2 py-4" style={{ color: 'var(--danger, #e5484d)' }}>
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {errMsg(clientsQuery.error)}
              </div>
            )}
            {clientsQuery.data && clientsQuery.data.clients.length === 0 && (
              <div className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
                No clients yet — add your first one on the left.
              </div>
            )}

            {clientsQuery.data && clientsQuery.data.clients.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'var(--text-tertiary)' }} className="text-xs text-left">
                    <th className="font-medium pb-1">Name</th>
                    <th className="font-medium pb-1">Billing</th>
                    <th className="font-medium pb-1">Sector</th>
                    <th className="font-medium pb-1">Status</th>
                    <th className="font-medium pb-1"></th>
                  </tr>
                </thead>
                <tbody style={{ color: 'var(--text-secondary)' }}>
                  {clientsQuery.data.clients.map((c) => (
                    <tr key={c.client_id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="py-2 pr-2">
                        <div style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                        {c.company && <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.company}</div>}
                      </td>
                      <td className="py-2 pr-2">
                        <div>{c.currency}</div>
                        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {TYPE_LABEL[c.type]}{c.hst_applicable ? '' : ''}
                        </div>
                      </td>
                      <td className="py-2 pr-2">{c.sector || '—'}</td>
                      <td className="py-2 pr-2">
                        <span className="chip" style={{ background: statusStyle(c.status).bg, color: statusStyle(c.status).fg }}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button className="text-xs flex items-center gap-1 ml-auto" style={{ color: 'var(--text-tertiary)' }}
                          onClick={() => startEdit(c)}>
                          <Pencil size={12} /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium"
      style={{
        color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
        borderBottom: active ? '2px solid var(--accent, var(--text-primary))' : '2px solid transparent',
        marginBottom: '-1px',
      }}
    >
      {icon} {label}
    </button>
  );
}
