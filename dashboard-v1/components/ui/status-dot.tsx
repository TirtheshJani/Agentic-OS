import { cn } from "@/lib/utils";

type State = "idle" | "running" | "blocked";

const STATE_CLASS: Record<State, string> = {
  idle: "bg-[var(--status-idle)]",
  running: "bg-[var(--status-running)] animate-pulse",
  blocked: "bg-[var(--status-blocked)]",
};

export function StatusDot({ state, className }: { state: State; className?: string }) {
  return (
    <span
      role="status"
      aria-label={state}
      className={cn("inline-block h-1.5 w-1.5 rounded-full", STATE_CLASS[state], className)}
    />
  );
}
