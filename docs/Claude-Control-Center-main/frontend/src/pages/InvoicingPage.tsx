import { useEffect, useMemo, useState } from 'react';
import {
  FileText, RefreshCw, ReceiptText, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import {
  useInvoicingConfig,
  useInvoicingTabs,
  useInvoicePreview,
  useCreateInvoice,
} from '../hooks/useInvoicing';
import type { CreateInvoiceResult } from '../api/invoicing';
import { ApiError } from '../api/client';

const today = () => new Date().toISOString().slice(0, 10);
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const errMsg = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : String(e));

export function InvoicingPage() {
  const { data: config } = useInvoicingConfig();
  const [spreadsheet, setSpreadsheet] = useState('');
  const [selectedTab, setSelectedTab] = useState<string | undefined>();
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [clientName, setClientName] = useState('');
  const [issue, setIssue] = useState(true);
  const [result, setResult] = useState<CreateInvoiceResult | null>(null);

  // Prefill the spreadsheet id from the backend default once it loads.
  useEffect(() => {
    if (config?.default_spreadsheet_id && !spreadsheet) {
      setSpreadsheet(config.default_spreadsheet_id);
    }
  }, [config, spreadsheet]);

  const tabsQuery = useInvoicingTabs(spreadsheet || undefined);
  const previewQuery = useInvoicePreview(spreadsheet || undefined, selectedTab);
  const createMutation = useCreateInvoice();

  const preview = previewQuery.data;

  // When the preview loads, seed the editable client-name field from the derived value.
  useEffect(() => {
    if (preview) setClientName(preview.client_name);
  }, [preview]);

  const total = useMemo(() => (preview ? preview.subtotal : 0), [preview]);

  async function handleCreate() {
    if (!selectedTab) return;
    setResult(null);
    const res = await createMutation.mutateAsync({
      spreadsheet: spreadsheet || undefined,
      tab: selectedTab,
      invoice_date: invoiceDate,
      client_name: clientName || undefined,
      issue,
    });
    setResult(res);
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-1">
        <ReceiptText size={20} style={{ color: 'var(--text-primary)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Invoicing</h1>
      </div>
      <p className="text-xs mb-5" style={{ color: 'var(--text-tertiary)' }}>
        Read a billing-cycle tab from Google Sheets and create a USD invoice in the BMO bookkeeper.
      </p>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(280px, 360px) 1fr' }}>
        {/* Left: source selection */}
        <div className="card" style={{ padding: '16px' }}>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
            Spreadsheet ID
          </label>
          <input
            className="input-field w-full mb-3 font-mono text-xs"
            value={spreadsheet}
            onChange={(e) => { setSpreadsheet(e.target.value.trim()); setSelectedTab(undefined); }}
            placeholder="Google Sheet ID"
          />

          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Tab (invoice)</label>
            <button
              className="text-xs flex items-center gap-1"
              style={{ color: 'var(--text-tertiary)' }}
              onClick={() => tabsQuery.refetch()}
              disabled={tabsQuery.isFetching}
            >
              <RefreshCw size={12} className={tabsQuery.isFetching ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {tabsQuery.isError && (
            <div className="text-xs flex items-start gap-1 mb-2" style={{ color: 'var(--danger, #e5484d)' }}>
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> {errMsg(tabsQuery.error)}
            </div>
          )}

          <div className="flex flex-col gap-1 max-h-[420px] overflow-auto">
            {tabsQuery.isLoading && (
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Loading tabs…</div>
            )}
            {tabsQuery.data?.tabs.map((tab) => (
              <button
                key={tab.gid}
                onClick={() => { setSelectedTab(tab.title); setResult(null); }}
                className="text-left text-sm px-2 py-1.5"
                style={{
                  borderRadius: 3,
                  background: selectedTab === tab.title ? 'var(--accent-soft, rgba(99,102,241,0.15))' : 'transparent',
                  color: selectedTab === tab.title ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {tab.title}
              </button>
            ))}
          </div>
        </div>

        {/* Right: preview + create */}
        <div className="card" style={{ padding: '16px' }}>
          {!selectedTab && (
            <div className="flex flex-col items-center justify-center text-center py-16" style={{ color: 'var(--text-tertiary)' }}>
              <FileText size={28} className="mb-2 opacity-50" />
              <div className="text-sm">Select a tab to preview its line items.</div>
            </div>
          )}

          {selectedTab && previewQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm py-8" style={{ color: 'var(--text-tertiary)' }}>
              <Loader2 size={14} className="animate-spin" /> Reading sheet…
            </div>
          )}

          {selectedTab && previewQuery.isError && (
            <div className="text-sm flex items-start gap-2 py-4" style={{ color: 'var(--danger, #e5484d)' }}>
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {errMsg(previewQuery.error)}
            </div>
          )}

          {preview && (
            <>
              <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{preview.title}</div>

              <table className="w-full text-sm mb-4">
                <thead>
                  <tr style={{ color: 'var(--text-tertiary)' }} className="text-xs text-left">
                    <th className="font-medium pb-1">Description</th>
                    <th className="font-medium pb-1 text-right">Qty</th>
                    <th className="font-medium pb-1 text-right">Unit (USD)</th>
                    <th className="font-medium pb-1 text-right">Total (USD)</th>
                  </tr>
                </thead>
                <tbody style={{ color: 'var(--text-secondary)' }}>
                  {preview.line_items.map((li, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="py-1.5 pr-2">{li.description}</td>
                      <td className="py-1.5 text-right">{li.qty ?? '—'}</td>
                      <td className="py-1.5 text-right">{li.unit != null ? usd(li.unit) : '—'}</td>
                      <td className="py-1.5 text-right">{usd(li.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--border)', color: 'var(--text-primary)' }} className="font-semibold">
                    <td className="pt-2" colSpan={3}>Subtotal (USD)</td>
                    <td className="pt-2 text-right">{usd(total)}</td>
                  </tr>
                </tfoot>
              </table>

              {preview.issued && (
                <div className="text-xs mb-3 flex items-center gap-1" style={{ color: 'var(--warning, #f5a623)' }}>
                  <AlertCircle size={13} /> Sheet marks this as already issued: “{preview.issued}”.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Client name</label>
                  <input className="input-field w-full text-sm" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Invoice date</label>
                  <input type="date" className="input-field w-full text-sm" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={issue} onChange={(e) => setIssue(e.target.checked)} />
                Issue immediately (post journal entry: Dr AR / Cr Revenue)
              </label>

              <button
                className="btn-primary flex items-center gap-2"
                onClick={handleCreate}
                disabled={createMutation.isPending || !clientName}
              >
                {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ReceiptText size={14} />}
                {issue ? 'Create & issue invoice' : 'Create draft invoice'}
              </button>

              {createMutation.isError && (
                <div className="text-sm flex items-start gap-2 mt-3" style={{ color: 'var(--danger, #e5484d)' }}>
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {errMsg(createMutation.error)}
                </div>
              )}

              {result && (
                <div className="card mt-3" style={{ padding: '12px 14px', background: 'rgba(46,160,67,0.08)' }}>
                  <div className="flex items-center gap-2 text-sm font-semibold mb-1" style={{ color: 'var(--success, #2ea043)' }}>
                    <CheckCircle2 size={15} /> Invoice #{result.invoice.id} {result.issued ? 'issued' : 'created (draft)'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {result.invoice.client_name} · {result.invoice.currency} {usd(result.invoice.total)} ·
                    status {result.invoice.status}
                    {result.invoice.journal_entry_id ? ` · JE #${result.invoice.journal_entry_id}` : ''}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
