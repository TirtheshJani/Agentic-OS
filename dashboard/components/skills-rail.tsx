"use client";

import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FAMILY_LABEL, FAMILY_ORDER, type BranchFamily } from "@/lib/branches";
import { cn } from "@/lib/utils";
import type { Skill } from "@/lib/skills-loader";
import type { Project } from "@/lib/projects-loader";

type Props = {
  skills: Skill[];
  projects: Project[];
  selectedSkill: string | null;
  selectedProject: string | null;
  onSelectSkill: (slug: string) => void;
  onSelectProject: (slug: string | null) => void;
};

export function SkillsRail({
  skills,
  projects,
  selectedSkill,
  selectedProject,
  onSelectSkill,
  onSelectProject,
}: Props) {
  const byFamily = new Map<BranchFamily, Map<string, Skill[]>>();
  for (const fam of FAMILY_ORDER) byFamily.set(fam, new Map());
  for (const s of skills) {
    const fam = byFamily.get(s.branch.family)!;
    if (!fam.has(s.branch.label)) fam.set(s.branch.label, []);
    fam.get(s.branch.label)!.push(s);
  }

  const activeProjects = projects.filter((p) => p.status === "active");
  const dormantProjects = projects.filter((p) => p.status !== "active");

  return (
    <ScrollArea className="h-full">
      <div className="px-2 py-2 space-y-4">
        <section>
          <SectionHeader
            title={FAMILY_LABEL.project}
            meta={
              selectedProject ? (
                <button
                  onClick={() => onSelectProject(null)}
                  className="mono-label text-muted-foreground hover:text-foreground"
                  aria-label="Clear project selection"
                >
                  CLEAR
                </button>
              ) : (
                <Pill tone="muted">{projects.length}</Pill>
              )
            }
          />
          {projects.length === 0 && (
            <div className="text-xs text-muted-foreground px-2 py-1">
              No projects. Add a PROJECT.md under vault/projects/.
            </div>
          )}
          <div className="space-y-0.5">
            {activeProjects.map((p) => (
              <ProjectRow
                key={p.slug}
                project={p}
                selected={selectedProject === p.slug}
                onSelect={onSelectProject}
              />
            ))}
          </div>
          {dormantProjects.length > 0 && (
            <details className="mt-2">
              <summary className="mono-label text-muted-foreground px-2 py-1 cursor-pointer hover:text-foreground">
                DORMANT · {dormantProjects.length}
              </summary>
              <div className="space-y-0.5 mt-1">
                {dormantProjects.map((p) => (
                  <ProjectRow
                    key={p.slug}
                    project={p}
                    selected={selectedProject === p.slug}
                    onSelect={onSelectProject}
                  />
                ))}
              </div>
            </details>
          )}
        </section>

        {FAMILY_ORDER.filter((f) => f !== "project").map((fam) => {
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
                        onClick={() => onSelectSkill(s.name)}
                        className={cn(
                          "w-full text-left rounded-sm px-2 py-1.5 text-xs font-mono transition-colors",
                          "hover:bg-accent/20 hover:text-foreground",
                          selectedSkill === s.name && "bg-accent/30 text-foreground"
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

function ProjectRow({
  project,
  selected,
  onSelect,
}: {
  project: Project;
  selected: boolean;
  onSelect: (slug: string | null) => void;
}) {
  return (
    <button
      onClick={() => onSelect(selected ? null : project.slug)}
      className={cn(
        "w-full text-left rounded-sm px-2 py-1.5 text-xs font-mono transition-colors",
        "hover:bg-primary/15 hover:text-foreground",
        selected && "bg-primary/25 text-foreground",
        !project.pathExists && "opacity-60"
      )}
      title={project.description}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{project.name}</span>
        <span className="flex items-center gap-1 shrink-0">
          <Pill tone="muted">{project.branch.slice(0, 4).toUpperCase()}</Pill>
          {!project.pathExists && <Pill tone="bad">MISSING</Pill>}
        </span>
      </div>
    </button>
  );
}

