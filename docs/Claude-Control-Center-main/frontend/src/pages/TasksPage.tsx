import { CheckSquare, Lock, Hash } from 'lucide-react';
import { useTasks } from '../hooks/useSettings';

export function TasksPage() {
  const { data: tasks, isLoading } = useTasks();

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <CheckSquare size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Tasks</h1>
      </div>

      {isLoading && (
        <div className="card overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton h-4 w-64" />
              <div className="skeleton h-4 w-16 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && !tasks?.length && (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No active tasks</p>
        </div>
      )}

      {!isLoading && tasks && tasks.length > 0 && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[3fr_1fr_1fr] gap-4 px-4 py-2 text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
            <span>UUID</span>
            <span>Lock</span>
            <span>Highwatermark</span>
          </div>
          {tasks.map((task) => (
            <div
              key={task.uuid}
              className="grid grid-cols-[3fr_1fr_1fr] gap-4 px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>
                {task.uuid}
              </span>
              <div className="flex items-center">
                {task.hasLock ? (
                  <span className="chip" style={{ background: 'var(--success-dim)', color: 'var(--success)' }}>
                    <Lock size={10} /> locked
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                )}
              </div>
              <div className="flex items-center">
                {task.highwatermark != null ? (
                  <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                    <Hash size={10} />{task.highwatermark}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
