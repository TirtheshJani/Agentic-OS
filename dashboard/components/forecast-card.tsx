import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import { loadSchedules } from "@/lib/schedules";

export function ForecastCard() {
  const specs = loadSchedules();
  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="FORECAST · ROUTINES" meta={<Pill tone="muted">{specs.length}</Pill>} />
      {specs.length === 0 && (
        <div className="text-xs text-muted-foreground mt-1">No remote schedules registered.</div>
      )}
      <ul className="space-y-1 mt-1">
        {specs.map((s) => (
          <li key={s.file} className="text-xs space-y-0.5">
            <div className="flex items-center justify-between gap-2 font-mono">
              <span className="truncate">{s.skill}</span>
              <span className="text-muted-foreground shrink-0">{s.relativeText}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-muted-foreground font-mono">
              <span className="truncate">{s.cron}</span>
              <span className="shrink-0">{s.absoluteText}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
