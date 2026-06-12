interface SectionHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned action slot (buttons, filters). */
  action?: React.ReactNode;
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        {description && <p className="text-sm text-ink2 mt-0.5">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </header>
  );
}
