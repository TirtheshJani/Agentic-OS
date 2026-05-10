import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { automationsRemotePath } from "@/lib/paths";

type Spec = { file: string; schedule: string; skill: string };

function loadSpecs(): Spec[] {
  const out: Spec[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(automationsRemotePath, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".md") || e.name === "README.md")
      continue;
    const raw = fs.readFileSync(path.join(automationsRemotePath, e.name), "utf8");
    const fm = matter(raw).data as { schedule?: string; skill?: string };
    if (!fm.schedule || !fm.skill) continue;
    out.push({ file: e.name, schedule: fm.schedule, skill: fm.skill });
  }
  return out;
}

export function ForecastCard() {
  const specs = loadSpecs();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecast</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {specs.length === 0 && (
          <div className="text-xs text-muted-foreground">
            No remote schedules registered.
          </div>
        )}
        {specs.map((s) => (
          <div
            key={s.file}
            className="text-xs flex items-center justify-between gap-2"
          >
            <span className="font-mono truncate">{s.skill}</span>
            <span className="text-muted-foreground font-mono shrink-0">
              {s.schedule}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
