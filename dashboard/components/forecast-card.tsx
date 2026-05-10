import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadSchedules } from "@/lib/schedules";

export function ForecastCard() {
  const specs = loadSchedules();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecast</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {specs.length === 0 && (
          <div className="text-xs text-muted-foreground">
            No remote schedules registered.
          </div>
        )}
        {specs.map((s) => (
          <div key={s.file} className="text-xs space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono truncate">{s.skill}</span>
              <span className="text-muted-foreground shrink-0">
                {s.relativeText}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <span className="font-mono truncate">{s.cron}</span>
              <span className="shrink-0">{s.absoluteText}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
