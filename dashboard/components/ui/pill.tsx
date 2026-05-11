import { cn } from "@/lib/utils";

type PillTone = "default" | "muted" | "good" | "warn" | "bad";

const TONE_CLASS: Record<PillTone, string> = {
  default: "text-foreground border-border",
  muted: "text-muted-foreground border-border",
  good: "text-[oklch(0.78_0.18_130)] border-[oklch(0.78_0.18_130)]",
  warn: "text-[oklch(0.78_0.15_80)] border-[oklch(0.78_0.15_80)]",
  bad: "text-[oklch(0.7_0.2_30)] border-[oklch(0.7_0.2_30)]",
};

export function Pill({
  children,
  tone = "default",
  glyph,
  className,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  glyph?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 border rounded-sm mono-label",
        TONE_CLASS[tone],
        className
      )}
    >
      {glyph && <span aria-hidden>{glyph}</span>}
      <span>{children}</span>
    </span>
  );
}
