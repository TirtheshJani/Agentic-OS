interface EmptyStateProps {
  message: string;
  /** Fixed pixel height — handy for keeping chart slots from collapsing. */
  height?: number;
}

/** Centered muted placeholder for "no data" / empty result states. */
export function EmptyState({ message, height }: EmptyStateProps) {
  return (
    <div
      className="flex items-center justify-center text-xs text-center"
      style={{ height, padding: height ? undefined : '16px 0', color: 'var(--text-tertiary)' }}
    >
      {message}
    </div>
  );
}
