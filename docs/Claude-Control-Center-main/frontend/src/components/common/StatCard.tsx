import type { ElementType, ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Optional caption shown under the value (vertical layout only). */
  sub?: string;
  /** When provided, renders the compact horizontal layout with a leading icon. */
  icon?: ElementType;
}

/**
 * Shared metric card. Two layouts:
 *  - vertical (default): big value over an optional caption — used on Analytics.
 *  - horizontal (when `icon` is set): leading accent icon beside label/value —
 *    used on the Workspace dashboard.
 */
export function StatCard({ label, value, sub, icon: Icon }: StatCardProps) {
  if (Icon) {
    return (
      <div className="card px-4 py-3 flex items-center gap-3">
        <Icon size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <div>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            {label}
          </div>
          <div className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {value}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card px-4 py-3 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </span>
      <span className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value ?? '—'}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {sub}
        </span>
      )}
    </div>
  );
}
