"use client";

import { Button } from "@/components/ui/button";
import type { Skill } from "@/lib/skills-loader";

type Props = {
  skill: Skill | null;
  userInput: string;
  onUserInput: (v: string) => void;
  onRun: () => void;
  running: boolean;
};

export function PromptPanel({ skill, userInput, onUserInput, onRun, running }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-muted-foreground">Selected skill</div>
        <div className="text-sm font-mono">{skill ? skill.name : "—"}</div>
        {skill && (
          <div className="text-xs text-muted-foreground mt-1 line-clamp-3">
            {skill.description}
          </div>
        )}
      </div>
      <div>
        <label htmlFor="user-input" className="text-xs text-muted-foreground">
          Inputs (optional)
        </label>
        <textarea
          id="user-input"
          value={userInput}
          onChange={(e) => onUserInput(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm font-mono"
          placeholder={skill ? `Inputs for ${skill.name}…` : "Pick a skill from the left."}
          disabled={!skill || running}
        />
      </div>
      <Button onClick={onRun} disabled={!skill || running} aria-busy={running}>
        {running ? "Running…" : "Run"}
      </Button>
    </div>
  );
}
