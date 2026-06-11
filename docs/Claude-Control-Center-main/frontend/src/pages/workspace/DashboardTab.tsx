import { Mail, Calendar, CheckSquare, HardDrive, Play, Clock, AlertCircle } from 'lucide-react';
import type { GwsRecipe, GwsSnapshotSection, GwsAuditRecord } from '../../api/gws';
import { StatCard } from '../../components/common/StatCard';
import { asArray, InboxPanel, AgendaPanel, TasksPanel, DrivePanel } from './panels';
import { RecipeCard } from './RecipeCard';
import { AuditRow } from './rows';
import { CodexBridgeCard } from './CodexBridgeCard';

export function DashboardTab({
  status, snapshot, recipes, audit,
}: {
  status: { binary_found: boolean } | undefined;
  snapshot: Record<string, unknown> | undefined;
  recipes: GwsRecipe[] | undefined;
  audit: GwsAuditRecord[] | undefined;
}) {
  const snap = snapshot as { inbox?: GwsSnapshotSection; agenda?: GwsSnapshotSection; tasks?: GwsSnapshotSection; drive?: GwsSnapshotSection } | undefined;
  const inboxItems = asArray(snap?.inbox?.items);
  const agendaItems = asArray(snap?.agenda?.items);
  const taskItems = asArray(snap?.tasks?.items);
  const driveItems = asArray(snap?.drive?.items);
  const unavailable = status && !status.binary_found;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      {unavailable && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
        >
          <AlertCircle size={16} />
          <div>
            <div className="text-sm font-medium">GWS binary not found</div>
            <div className="text-xs mt-0.5">
              Ensure <code>gws</code> is installed and on PATH, or set <code>GWS_BINARY</code> in <code>.env</code>.
              Docker deployments do not have access to the host gws binary.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Unread" value={inboxItems.length} icon={Mail} />
        <StatCard label="Events today" value={agendaItems.length} icon={Calendar} />
        <StatCard label="Open tasks" value={taskItems.length} icon={CheckSquare} />
        <StatCard label="Recent files" value={driveItems.length} icon={HardDrive} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InboxPanel data={snap?.inbox} />
        <AgendaPanel data={snap?.agenda} />
        <TasksPanel data={snap?.tasks} />
        <DrivePanel data={snap?.drive} />
      </div>

      {recipes && recipes.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
            <Play size={11} />
            Workflows
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recipes.filter((r) => r.enabled !== false).map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        </div>
      )}

      {audit && audit.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
            <Clock size={11} />
            Recent Activity
          </div>
          <div className="space-y-1">
            {audit.filter((r) => r.source !== 'snapshot').slice(0, 15).map((record, i) => (
              <AuditRow key={i} record={record} />
            ))}
          </div>
        </div>
      )}

      <CodexBridgeCard />
    </div>
  );
}
