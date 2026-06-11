import type { CSSProperties } from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  /** Optional leading label, e.g. "Source:". */
  label?: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  /** Label for the "match anything" chip. Pass null to omit it. */
  allLabel?: string | null;
  /** Value that represents the "all" selection. Defaults to "". */
  allValue?: string;
}

/**
 * Horizontal row of chip-style filter buttons with a single active value.
 * Used by the Workspace activity log (source / service filters).
 */
export function FilterBar({
  label,
  options,
  value,
  onChange,
  allLabel = 'All',
  allValue = '',
}: FilterBarProps) {
  const chipStyle = (active: boolean): CSSProperties => ({
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    cursor: 'pointer',
    border: 'none',
    fontWeight: active ? 600 : 400,
    background: active ? 'var(--accent-dim)' : 'var(--bg-secondary)',
    color: active ? 'var(--accent)' : 'var(--text-tertiary)',
  });

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {label && (
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {label}
        </span>
      )}
      {allLabel !== null && (
        <button style={chipStyle(value === allValue)} onClick={() => onChange(allValue)}>
          {allLabel}
        </button>
      )}
      {options.map((opt) => (
        <button key={opt.value} style={chipStyle(value === opt.value)} onClick={() => onChange(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
