import clsx from "clsx";

type Tone = "ok" | "accent" | "warn" | "danger" | "neutral";

const tones: Record<Tone, string> = {
  ok: "bg-ok",
  accent: "bg-accent",
  warn: "bg-warn",
  danger: "bg-danger",
  neutral: "bg-ink3",
};

interface StatusDotProps {
  tone?: Tone;
  /** Pulse for live/running states. */
  pulse?: boolean;
  className?: string;
}

export function StatusDot({ tone = "neutral", pulse = false, className }: StatusDotProps) {
  return (
    <span
      className={clsx("inline-block w-[7px] h-[7px] rounded-full shrink-0", tones[tone], pulse && "animate-pulse", className)}
    />
  );
}
