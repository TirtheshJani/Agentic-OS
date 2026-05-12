"use client";

import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import type { Skill } from "@/lib/skills-loader";
import type { Project } from "@/lib/projects-loader";

type Props = {
  skill: Skill | null;
  project: Project | null;
  userInput: string;
  onUserInput: (v: string) => void;
  onRun: () => void;
  running: boolean;
};

export function PromptPanel({ skill, project, userInput, onUserInput, onRun, running }: Props) {
  const hasInput = userInput.trim().length > 0;
  const canRun = !!skill || hasInput;
  const agent = skill?.agent ?? project?.agent ?? null;

  if (!skill && !project) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
        <Pill tone="muted">READY</Pill>
        <h2 className="font-mono text-2xl tracking-wider">
          PICK A <span className="text-primary">PROJECT</span> OR <span className="text-primary">SKILL</span>
        </h2>
        <p className="text-xs text-muted-foreground">
          select on the left · type a prompt · press run
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="space-y-1 min-w-0">
          {project && (
            <div className="flex items-baseline gap-2 truncate">
              <span className="mono-label text-muted-foreground">PROJECT</span>
              <span className="font-mono text-sm text-foreground truncate" title={project.path}>
                {project.name}
              </span>
            </div>
          )}
          {skill ? (
            <div className="flex items-baseline gap-2">
              <span className="mono-label text-muted-foreground">SKILL</span>
              <span className="font-mono text-sm text-foreground">{skill.name}</span>
            </div>
          ) : (
            <div className="mono-label text-muted-foreground">FREEFORM PROMPT</div>
          )}
        </div>
        <span className="flex items-center gap-1 shrink-0">
          {agent && <Pill tone="muted">A · {agent}</Pill>}
          {skill?.cadence && <Pill tone="muted">{skill.cadence}</Pill>}
          {skill?.status === "stub" && <Pill tone="muted">STUB</Pill>}
          {skill?.status === "authored" && <Pill tone="good">READY</Pill>}
        </span>
      </div>

      {skill && (
        <p className="text-xs text-muted-foreground line-clamp-3">{skill.description}</p>
      )}
      {!skill && project && (
        <p className="text-xs text-muted-foreground line-clamp-3">{project.description}</p>
      )}

      <div>
        <label htmlFor="user-input" className="mono-label text-muted-foreground">
          {skill ? "INPUTS · optional" : "PROMPT · required"}
        </label>
        <textarea
          id="user-input"
          value={userInput}
          onChange={(e) => onUserInput(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-sm border border-border bg-background p-2 text-sm font-mono"
          placeholder={
            skill
              ? `inputs for ${skill.name}…`
              : project
                ? `what should I do in ${project.name}?`
                : "type a prompt…"
          }
          disabled={running}
        />
      </div>

      <Button onClick={onRun} disabled={running || !canRun} aria-busy={running}>
        {running ? "RUNNING…" : "RUN"}
      </Button>
    </div>
  );
}
