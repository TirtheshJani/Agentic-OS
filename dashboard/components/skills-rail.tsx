"use client";

import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FAMILY_LABEL, FAMILY_ORDER, type BranchFamily } from "@/lib/branches";
import { cn } from "@/lib/utils";
import type { Skill } from "@/lib/skills-loader";

type Props = {
  skills: Skill[];
  selected: string | null;
  onSelect: (slug: string) => void;
};

export function SkillsRail({ skills, selected, onSelect }: Props) {
  const byFamily = new Map<BranchFamily, Map<string, Skill[]>>();
  for (const fam of FAMILY_ORDER) byFamily.set(fam, new Map());
  for (const s of skills) {
    const fam = byFamily.get(s.branch.family)!;
    if (!fam.has(s.branch.label)) fam.set(s.branch.label, []);
    fam.get(s.branch.label)!.push(s);
  }

  return (
    <ScrollArea className="h-full">
      <div className="px-2 py-2 space-y-4">
        {FAMILY_ORDER.map((fam) => {
          const groups = byFamily.get(fam)!;
          if (groups.size === 0) return null;
          return (
            <section key={fam}>
              <SectionHeader title={FAMILY_LABEL[fam]} />
              {[...groups.entries()].map(([label, list]) => (
                <div key={label} className="mb-3">
                  <div className="mono-label text-muted-foreground px-2 py-1">{label}</div>
                  <div className="space-y-0.5">
                    {list.map((s) => (
                      <button
                        key={s.folder}
                        onClick={() => onSelect(s.name)}
                        className={cn(
                          "w-full text-left rounded-sm px-2 py-1.5 text-xs font-mono transition-colors",
                          "hover:bg-accent/20 hover:text-foreground",
                          selected === s.name && "bg-accent/30 text-foreground"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{s.name}</span>
                          <span className="flex items-center gap-1 shrink-0">
                            {s.cadence && <Pill tone="muted">{s.cadence}</Pill>}
                            {s.status === "stub" && <Pill tone="muted">STUB</Pill>}
                            {s.status === "authored" && <Pill tone="good">READY</Pill>}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </ScrollArea>
  );
}
