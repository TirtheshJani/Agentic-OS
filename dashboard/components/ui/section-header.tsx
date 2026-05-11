import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  meta,
  glyph = "◢",
  className,
}: {
  title: string;
  meta?: React.ReactNode;
  glyph?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 mono-label text-muted-foreground py-2",
        className
      )}
    >
      <span aria-hidden className="text-primary">{glyph}</span>
      <span className="text-foreground">{title}</span>
      <span aria-hidden className="flex-1 border-t border-border/60" />
      {meta && <span>{meta}</span>}
    </div>
  );
}
