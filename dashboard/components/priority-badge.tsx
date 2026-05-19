import { Pill } from "@/components/ui/pill";
import type { TaskPriority } from "@/lib/db";

// Phase 8.3 tone mapping: low=muted, med=default (Pill has no `info` tone),
// high=warn, urgent=bad. Null priority renders nothing.
export function PriorityBadge({
  priority,
  uppercase = false,
}: {
  priority: TaskPriority | string | null;
  uppercase?: boolean;
}) {
  if (!priority) return null;
  const tone =
    priority === "urgent"
      ? "bad"
      : priority === "high"
        ? "warn"
        : priority === "low"
          ? "muted"
          : "default";
  return <Pill tone={tone}>{uppercase ? priority.toUpperCase() : priority}</Pill>;
}
