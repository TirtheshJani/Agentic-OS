import { useMemo, useState } from 'react';
import {
  Plus, RefreshCw, AlertCircle, Loader2, X, GripVertical, ExternalLink,
} from 'lucide-react';
import {
  useDeals,
  usePipeline,
  useCreateDeal,
  useUpdateDeal,
} from '../../hooks/useCrm';
import {
  DEAL_STAGES,
} from '../../api/crm';
import type {
  Client, Deal, DealInput, DealStage, CurrencyTotals,
} from '../../api/crm';
import { ApiError } from '../../api/client';

const errMsg = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : String(e));

// Open (un-closed) stages drive the weighted-pipeline header.
const OPEN_STAGES: DealStage[] = ['New', 'Qualified', 'Proposal'];

const STAGE_ACCENT: Record<DealStage, string> = {
  New: 'var(--text-tertiary)',
  Qualified: '#4a9eed',
  Proposal: '#f5a623',
  Won: 'var(--success, #2ea043)',
  Lost: 'var(--danger, #e5484d)',
};

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

/** Render a per-currency totals map as "US$5,000 · CA$2,000"; "—" when empty. */
function fmtTotals(totals: CurrencyTotals): string {
  const parts = Object.entries(totals).filter(([, v]) => v);
  if (parts.length === 0) return '—';
  return parts.map(([cur, v]) => fmtMoney(v, cur)).join(' · ');
}

function sumTotals(maps: CurrencyTotals[]): CurrencyTotals {
  const out: CurrencyTotals = {};
  for (const m of maps) {
    for (const [cur, v] of Object.entries(m)) out[cur] = (out[cur] ?? 0) + v;
  }
  return out;
}

interface Props {
  clients: Client[];
  onOpenClient: (clientId: string) => void;
}

export function PipelineBoard({ clients, onOpenClient }: Props) {
  const dealsQuery = useDeals();
  const pipelineQuery = usePipeline();
  const createMutation = useCreateDeal();
  const updateMutation = useUpdateDeal();

  const [showForm, setShowForm] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<DealStage | null>(null);

  const clientById = useMemo(() => {
    const m = new Map<string, Client>();
    for (const c of clients) m.set(c.client_id, c);
    return m;
  }, [clients]);

  const dealsByStage = useMemo(() => {
    const groups: Record<DealStage, Deal[]> = {
      New: [], Qualified: [], Proposal: [], Won: [], Lost: [],
    };
    for (const d of dealsQuery.data?.deals ?? []) {
      if (groups[d.stage]) groups[d.stage].push(d);
    }
    return groups;
  }, [dealsQuery.data]);

  const pipeline = pipelineQuery.data;

  // Weighted value of all open deals (the headline pipeline number).
  const openWeighted = useMemo(() => {
    if (!pipeline) return {};
    return sumTotals(
      pipeline.stages.filter((s) => OPEN_STAGES.includes(s.stage)).map((s) => s.weighted),
    );
  }, [pipeline]);

  const openValue = useMemo(() => {
    if (!pipeline) return {};
    return sumTotals(
      pipeline.stages.filter((s) => OPEN_STAGES.includes(s.stage)).map((s) => s.value),
    );
  }, [pipeline]);

  const wonValue = useMemo(
    () => pipeline?.stages.find((s) => s.stage === 'Won')?.value ?? {},
    [pipeline],
  );

  function handleDrop(stage: DealStage) {
    const id = dragId;
    setDragId(null);
    setDragOver(null);
    if (!id) return;
    const deal = (dealsQuery.data?.deals ?? []).find((d) => d.deal_id === id);
    if (!deal || deal.stage === stage) return;
    updateMutation.mutate({ dealId: id, input: { stage } });
  }

  const stageSummary = (stage: DealStage) =>
    pipeline?.stages.find((s) => s.stage === stage);

  return (
    <div>
      {/* Headline metrics */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        <Metric label="Weighted pipeline" value={fmtTotals(openWeighted)} hint="Σ open value × probability" accent="var(--text-primary)" />
        <Metric label="Open value" value={fmtTotals(openValue)} hint={`${pipeline?.totals.count ?? 0} deals total`} accent="var(--text-secondary)" />
        <Metric label="Won" value={fmtTotals(wonValue)} hint="closed-won value" accent="var(--success, #2ea043)" />
      </div>

      <div className="flex items-center justify-between mb-3">
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? 'Close' : 'New deal'}
        </button>
        <button
          className="text-xs flex items-center gap-1"
          style={{ color: 'var(--text-tertiary)' }}
          onClick={() => { dealsQuery.refetch(); pipelineQuery.refetch(); }}
          disabled={dealsQuery.isFetching}
        >
          <RefreshCw size={12} className={dealsQuery.isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {showForm && (
        <NewDealForm
          clients={clients}
          submitting={createMutation.isPending}
          error={createMutation.error}
          onCancel={() => setShowForm(false)}
          onSubmit={async (input) => {
            await createMutation.mutateAsync(input);
            setShowForm(false);
          }}
        />
      )}

      {dealsQuery.isError && (
        <div className="text-sm flex items-start gap-2 py-3" style={{ color: 'var(--danger, #e5484d)' }}>
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {errMsg(dealsQuery.error)}
        </div>
      )}

      {dealsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm py-8" style={{ color: 'var(--text-tertiary)' }}>
          <Loader2 size={14} className="animate-spin" /> Loading pipeline…
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${DEAL_STAGES.length}, minmax(170px, 1fr))` }}>
          {DEAL_STAGES.map((stage) => {
            const summary = stageSummary(stage);
            return (
              <div
                key={stage}
                onDragOver={(e) => { e.preventDefault(); setDragOver(stage); }}
                onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
                onDrop={() => handleDrop(stage)}
                className="card"
                style={{
                  padding: '10px',
                  minHeight: 120,
                  background: dragOver === stage ? 'var(--bg-hover, rgba(255,255,255,0.04))' : undefined,
                  borderTop: `2px solid ${STAGE_ACCENT[stage]}`,
                  outline: dragOver === stage ? '1px dashed var(--border)' : 'none',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{stage}</span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{summary?.count ?? 0}</span>
                </div>
                <div className="text-[11px] mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  {fmtTotals(summary?.value ?? {})}
                </div>

                <div className="flex flex-col gap-2">
                  {dealsByStage[stage].map((deal) => (
                    <DealCard
                      key={deal.deal_id}
                      deal={deal}
                      clientName={clientById.get(deal.client_id)?.name}
                      dragging={dragId === deal.deal_id}
                      onDragStart={() => setDragId(deal.deal_id)}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      onOpenClient={() => onOpenClient(deal.client_id)}
                    />
                  ))}
                  {dealsByStage[stage].length === 0 && (
                    <div className="text-[11px] py-3 text-center" style={{ color: 'var(--text-tertiary)' }}>
                      —
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {updateMutation.isError && (
        <div className="text-sm flex items-start gap-2 mt-3" style={{ color: 'var(--danger, #e5484d)' }}>
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {errMsg(updateMutation.error)}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: string }) {
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="text-base font-semibold" style={{ color: accent }}>{value}</div>
      <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{hint}</div>
    </div>
  );
}

function DealCard({
  deal, clientName, dragging, onDragStart, onDragEnd, onOpenClient,
}: {
  deal: Deal;
  clientName?: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpenClient: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="card"
      style={{
        padding: '8px 9px',
        cursor: 'grab',
        opacity: dragging ? 0.4 : 1,
        background: 'var(--bg-secondary, rgba(255,255,255,0.02))',
      }}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }} title={deal.title}>
            {deal.title}
          </div>
          <button
            className="text-[11px] flex items-center gap-1 mt-0.5 truncate hover:underline"
            style={{ color: 'var(--text-tertiary)' }}
            onClick={onOpenClient}
            title={clientName ? `Open ${clientName}` : deal.client_id}
          >
            {clientName ?? deal.client_id} <ExternalLink size={9} className="flex-shrink-0" />
          </button>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {fmtMoney(deal.value, deal.currency)}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{deal.probability}%</span>
          </div>
          {deal.next_action && (
            <div className="text-[11px] mt-1 truncate" style={{ color: 'var(--text-tertiary)' }} title={deal.next_action}>
              → {deal.next_action}{deal.next_action_date ? ` (${deal.next_action_date})` : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewDealForm({
  clients, submitting, error, onSubmit, onCancel,
}: {
  clients: Client[];
  submitting: boolean;
  error: unknown;
  onSubmit: (input: DealInput) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.client_id ?? '');
  const [title, setTitle] = useState('');
  const [stage, setStage] = useState<DealStage>('New');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('');
  const [source, setSource] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');

  const selectedClient = clients.find((c) => c.client_id === clientId);
  // Currency defaults from the client's billing type unless the user overrides it.
  const effectiveCurrency = currency || selectedClient?.currency || 'USD';

  const canSubmit = !!clientId && !!title.trim() && !submitting;

  function submit() {
    if (!canSubmit) return;
    onSubmit({
      client_id: clientId,
      title: title.trim(),
      stage,
      value: value ? Number(value) : 0,
      currency: effectiveCurrency,
      source: source.trim(),
      next_action: nextAction.trim(),
      next_action_date: nextActionDate.trim(),
    });
  }

  return (
    <div className="card mb-4" style={{ padding: '14px' }}>
      <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>New deal</div>

      {clients.length === 0 ? (
        <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Add a client first — deals are always linked to a client.
        </div>
      ) : (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            <DealField label="Client *">
              <select className="input-field w-full text-sm" value={clientId} onChange={(e) => { setClientId(e.target.value); setCurrency(''); }}>
                {clients.map((c) => (
                  <option key={c.client_id} value={c.client_id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>
                ))}
              </select>
            </DealField>
            <DealField label="Title *">
              <input className="input-field w-full text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q3 retainer" />
            </DealField>
            <DealField label="Stage">
              <select className="input-field w-full text-sm" value={stage} onChange={(e) => setStage(e.target.value as DealStage)}>
                {DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </DealField>
            <DealField label={`Value (${effectiveCurrency})`}>
              <input className="input-field w-full text-sm" type="number" min="0" value={value}
                onChange={(e) => setValue(e.target.value)} placeholder="0" />
            </DealField>
            <DealField label="Currency">
              <input className="input-field w-full text-sm" value={effectiveCurrency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
            </DealField>
            <DealField label="Source">
              <input className="input-field w-full text-sm" value={source}
                onChange={(e) => setSource(e.target.value)} placeholder="e.g. referral, inbound" />
            </DealField>
            <DealField label="Next action">
              <input className="input-field w-full text-sm" value={nextAction}
                onChange={(e) => setNextAction(e.target.value)} placeholder="e.g. send proposal" />
            </DealField>
            <DealField label="Next action date">
              <input className="input-field w-full text-sm" type="date" value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)} />
            </DealField>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <button className="btn-primary flex items-center gap-2" onClick={submit} disabled={!canSubmit}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add deal
            </button>
            <button className="text-xs" style={{ color: 'var(--text-tertiary)' }} onClick={onCancel}>Cancel</button>
          </div>

          {error != null && (
            <div className="text-sm flex items-start gap-2 mt-3" style={{ color: 'var(--danger, #e5484d)' }}>
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {errMsg(error)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DealField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}
