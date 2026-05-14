"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OutputStream, type StreamEvent } from "@/components/output-stream";
import { PromptPanel } from "@/components/prompt-panel";
import { SkillsRail } from "@/components/skills-rail";
import { useRunState } from "@/components/run-state";
import type { Skill } from "@/lib/skills-loader";
import type { Project } from "@/lib/projects-loader";
import type { Agent } from "@/lib/agents-loader";

type Props = {
  skills: Skill[];
  projects: Project[];
  agents: Agent[];
};

export function Workbench({ skills, projects, agents }: Props) {
  const { running, setRunning, mergeUsage, resetUsage, setCurrentProject, setActiveMcp } =
    useRunState();
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [assignee, setAssignee] = useState<string>("user");

  const skill = useMemo(
    () => skills.find((s) => s.name === selectedSkill) ?? null,
    [skills, selectedSkill]
  );
  const project = useMemo(
    () => projects.find((p) => p.slug === selectedProject) ?? null,
    [projects, selectedProject]
  );

  useEffect(() => {
    setCurrentProject(selectedProject);
  }, [selectedProject, setCurrentProject]);

  const onRun = useCallback(async () => {
    const hasInput = userInput.trim().length > 0;
    if (!skill && !hasInput) return;

    // Assignee is not "user" -> enqueue as a task, do not stream
    if (assignee !== "user") {
      const dept = assignee.startsWith("lead:") ? assignee.slice(5) : null;
      const promptText = skill ? `Use ${skill.name}.\n${userInput}` : userInput;
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText,
            assignee,
            department: dept,
          }),
        });
        const j = await res.json();
        setEvents([
          {
            type: "delta",
            data: res.ok
              ? `Task ${j.id} enqueued for ${assignee}.\n`
              : `Error: ${j.error ?? "enqueue failed"}\n`,
          },
        ]);
      } catch (e) {
        setEvents([
          { type: "error", data: { message: e instanceof Error ? e.message : String(e) } },
        ]);
      }
      return;
    }

    // assignee === "user" -> existing immediate-run path
    setRunning(true);
    resetUsage();
    setActiveMcp(null);
    setEvents([]);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillSlug: skill?.name,
          projectSlug: project?.slug,
          userInput: skill ? userInput : undefined,
          prompt: !skill && hasInput ? userInput : undefined,
          agent: skill?.agent ?? project?.agent,
        }),
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
            if (evt.type === "usage") mergeUsage(evt.data);
            if (evt.type === "started") setActiveMcp(evt.activeMcp ?? null);
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
      setActiveMcp(null);
    }
  }, [skill, project, userInput, assignee, setRunning, resetUsage, mergeUsage, setActiveMcp]);

  return (
    <>
      <aside className="border border-border rounded-lg bg-card overflow-hidden">
        <SkillsRail
          skills={skills}
          projects={projects}
          selectedSkill={selectedSkill}
          selectedProject={selectedProject}
          onSelectSkill={setSelectedSkill}
          onSelectProject={setSelectedProject}
        />
      </aside>
      <section className="border border-border rounded-lg bg-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <PromptPanel
            skill={skill}
            project={project}
            userInput={userInput}
            onUserInput={setUserInput}
            onRun={onRun}
            running={running}
            agents={agents}
            assignee={assignee}
            onAssigneeChange={setAssignee}
          />
        </div>
        <div className="flex-1 min-h-0">
          <OutputStream events={events} />
        </div>
      </section>
    </>
  );
}
