import clsx from "clsx";

type Tone = "accent" | "ok" | "danger" | "neutral";

const tones: Record<Tone, string> = {
  accent: "bg-accent-bg text-accent-ink",
  ok: "bg-ok-bg text-ok",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-surface2 text-ink2",
};

interface PillProps {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}

/** Uppercase Oswald status/label pill (mockup motif). */
export function Pill({ tone = "neutral", className, children }: PillProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label uppercase tracking-wide text-[10px]",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
