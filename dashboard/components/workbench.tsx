"use client";

import { useCallback, useMemo, useState } from "react";
import { OutputStream, type StreamEvent } from "@/components/output-stream";
import { PromptPanel } from "@/components/prompt-panel";
import { SkillsRail } from "@/components/skills-rail";
import type { Skill } from "@/lib/skills-loader";

export function Workbench({ skills }: { skills: Skill[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [running, setRunning] = useState(false);

  const skill = useMemo(
    () => skills.find((s) => s.name === selected) ?? null,
    [skills, selected]
  );

  const onRun = useCallback(async () => {
    if (!skill) return;
    setRunning(true);
    setEvents([]);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillSlug: skill.name, userInput }),
      });
      if (!res.body) {
        setEvents([{ type: "error", data: { message: "no response body" } }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (!chunk.startsWith("data:")) continue;
          const json = chunk.replace(/^data:\s*/, "");
          try {
            const evt = JSON.parse(json) as StreamEvent;
            setEvents((prev) => [...prev, evt]);
          } catch {
            /* ignore non-JSON lines */
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setEvents((prev) => [...prev, { type: "error", data: { message: msg } }]);
    } finally {
      setRunning(false);
    }
  }, [skill, userInput]);

  return (
    <>
      <aside className="border border-border rounded-lg bg-card overflow-hidden">
        <SkillsRail skills={skills} selected={selected} onSelect={setSelected} />
      </aside>
      <section className="border border-border rounded-lg bg-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <PromptPanel
            skill={skill}
            userInput={userInput}
            onUserInput={setUserInput}
            onRun={onRun}
            running={running}
          />
        </div>
        <div className="flex-1 min-h-0">
          <OutputStream events={events} />
        </div>
      </section>
    </>
  );
}
