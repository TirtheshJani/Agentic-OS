"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Skill } from "@/lib/skills-loader";

type Props = {
  skills: Skill[];
  selected: string | null;
  onSelect: (slug: string) => void;
};

export function SkillsRail({ skills, selected, onSelect }: Props) {
  const grouped = new Map<string, Skill[]>();
  for (const s of skills) {
    const key = s.domain || "uncategorized";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }
  const domains = Array.from(grouped.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <ScrollArea className="h-full">
      <div className="px-3 py-2 space-y-3">
        {domains.map(([domain, list]) => (
          <div key={domain}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
              {domain}
            </div>
            <div className="space-y-0.5">
              {list.map((s) => (
                <button
                  key={s.folder}
                  onClick={() => onSelect(s.name)}
                  className={cn(
                    "w-full text-left rounded-md px-2 py-1.5 text-xs transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    selected === s.name &&
                      "bg-accent text-accent-foreground font-medium"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{s.name}</span>
                    {s.status === "stub" && (
                      <Badge variant="muted" className="shrink-0">
                        stub
                      </Badge>
                    )}
                    {s.status === "authored" && (
                      <Badge variant="success" className="shrink-0">
                        ready
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
