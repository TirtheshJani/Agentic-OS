"use client";

import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import type { Skill } from "@/lib/skills-loader";

type Props = {
  skill: Skill | null;
  userInput: string;
  onUserInput: (v: string) => void;
  onRun: () => void;
  running: boolean;
};

export function PromptPanel({ skill, userInput, onUserInput, onRun, running }: Props) {
  if (!skill) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
        <Pill tone="muted">READY</Pill>
        <h2 className="font-mono text-2xl tracking-wider">
          RUN A <span className="text-primary">SKILL</span> TO BEGIN
        </h2>
        <p className="text-xs text-muted-foreground">
          click a skill · press run · or type any prompt
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="mono-label text-muted-foreground">SELECTED</div>
          <div className="font-mono text-sm text-foreground">{skill.name}</div>
        </div>
        <span className="flex items-center gap-1">
          {skill.cadence && <Pill tone="muted">{skill.cadence}</Pill>}
          {skill.status === "stub" && <Pill tone="muted">STUB</Pill>}
          {skill.status === "authored" && <Pill tone="good">READY</Pill>}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-3">{skill.description}</p>
      <div>
        <label htmlFor="user-input" className="mono-label text-muted-foreground">
          INPUTS · optional
        </label>
        <textarea
          id="user-input"
          value={userInput}
          onChange={(e) => onUserInput(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-sm border border-border bg-background p-2 text-sm font-mono"
          placeholder={`inputs for ${skill.name}…`}
          disabled={running}
        />
      </div>
      <Button onClick={onRun} disabled={running} aria-busy={running}>
        {running ? "RUNNING…" : "RUN"}
      </Button>
    </div>
  );
}
