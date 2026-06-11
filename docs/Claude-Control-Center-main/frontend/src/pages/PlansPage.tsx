import { useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { PlanList } from '../components/plans/PlanList';
import { PlanViewer } from '../components/plans/PlanViewer';

export function PlansPage() {
  const { slug } = useParams<{ slug?: string }>();

  return (
    <div className="flex h-full" style={{ minHeight: 0 }}>
      {/* Sidebar */}
      <div
        className="w-64 flex-shrink-0 overflow-y-auto"
        style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-sidebar)' }}
      >
        <div className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <FileText size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Plans</span>
        </div>
        <PlanList />
      </div>

      {/* Viewer */}
      <div className="flex-1 overflow-y-auto">
        {slug ? (
          <PlanViewer slug={decodeURIComponent(slug)} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Select a plan to view
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
