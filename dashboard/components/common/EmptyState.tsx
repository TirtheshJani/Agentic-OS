interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <h3 className="font-medium text-ink">{title}</h3>
      <p className="text-sm text-ink3 mt-1">{description}</p>
    </div>
  );
}
