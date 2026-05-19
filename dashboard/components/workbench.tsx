"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OutputStream, type StreamEvent } from "@/components/output-stream";
import { PromptPanel } from "@/components/prompt-panel";
import { RouterPanel } from "@/components/router-panel";
import { SkillsRail } from "@/components/skills-rail";
import { useRunState } from "@/components/run-state";
import type { Skill } from "@/lib/skills-loader";
import type { Project } from "@/lib/projects-loader";
import type { Agent } from "@/lib/agents-loader";

type Props = {
  skills: Skill[];
  projects: Project[];
  agents: Agent[];
  // Seeds pulled from `?project=`, `?prompt=`, `?agent=` on the server. The
  // issue-launch "Run headless" navigation lands here so the workbench
  // prefills and the user just clicks Run.
  initialProjectSlug?: string | null;
  initialPrompt?: string | null;
  initialAssignee?: string | null;
};

export function Workbench({
  skills,
  projects,
  agents,
  initialProjectSlug,
  initialPrompt,
  initialAssignee,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { running, setRunning, mergeUsage, resetUsage, setCurrentProject, setActiveMcp } =
    useRunState();
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(
    initialProjectSlug ?? null
  );
  const [userInput, setUserInput] = useState(initialPrompt ?? "");
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [assignee, setAssignee] = useState<string>(initialAssignee ?? "user");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Keep the URL `?project=<slug>` in sync with the selection so the URL is
  // the single source of truth: deep links work, refresh preserves state,
  // and the server-rendered status card stays consistent. We replace rather
  // than push so the back button does not collect every selection toggle.
  const syncProjectInUrl = useCallback(
    (slug: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const current = params.get("project");
      if (slug) {
        if (current === slug) return;
        params.set("project", slug);
      } else {
        if (current === null) return;
        params.delete("project");
      }
      const query = params.toString();
      router.replace(query ? `/?${query}` : "/", { scroll: false });
    },
    [router, searchParams]
  );

  const handleSelectProject = useCallback(
    (slug: string | null) => {
      setSelectedProject(slug);
      syncProjectInUrl(slug);
    },
    [syncProjectInUrl]
  );

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

  const dispatchRun = useCallback(
    async (args: {
      skillSlug?: string;
      teamSlug?: string;
      userInput?: string;
      prompt?: string;
      agent?: string | null;
      assignee?: string;
      preamble?: string;
    }) => {
      const hasFreeform = (args.prompt ?? "").trim().length > 0;
      const hasUserInput = (args.userInput ?? "").trim().length > 0;
      if (!args.skillSlug && !hasFreeform && !hasUserInput) return;

      const ass = args.assignee ?? "user";
      if (ass !== "user") {
        const dept = ass.startsWith("lead:") ? ass.slice(5) : null;
        const promptText = args.skillSlug
          ? `Use ${args.skillSlug}.\n${args.userInput ?? ""}`
          : args.prompt ?? "";
        try {
          const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: promptText, assignee: ass, department: dept }),
          });
          const j = await res.json();
          setEvents([
            {
              type: "delta",
              data: res.ok
                ? `Task ${j.id} enqueued for ${ass}.\n`
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

      setRunning(true);
      resetUsage();
      setActiveMcp(null);
      setEvents(
        args.preamble
          ? [{ type: "delta", data: args.preamble }]
          : []
      );
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skillSlug: args.skillSlug,
            teamSlug: args.teamSlug,
            userInput: args.skillSlug ? args.userInput : undefined,
            prompt: !args.skillSlug && hasFreeform ? args.prompt : undefined,
            agent: args.agent ?? undefined,
          }),
          signal: controller.signal,
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
      if (e instanceof DOMException && e.name === "AbortError") {
        // user navigated away or started a new run; not a real error
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      setEvents((prev) => [...prev, { type: "error", data: { message: msg } }]);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setRunning(false);
      setActiveMcp(null);
    }
  }, [setRunning, resetUsage, mergeUsage, setActiveMcp]);

  const onRun = useCallback(() => {
    return dispatchRun({
      skillSlug: skill?.name,
      teamSlug: project?.slug,
      userInput,
      prompt: userInput,
      agent: skill?.agent ?? project?.agent ?? null,
      assignee,
    });
  }, [dispatchRun, skill, project, userInput, assignee]);

  const onRouted = useCallback(
    ({
      teamSlug,
      teamName,
      prompt,
      routeMode,
      routeReason,
    }: {
      teamSlug: string;
      teamName: string;
      prompt: string;
      routeMode: "deterministic" | "llm";
      routeReason: string;
    }) => {
      handleSelectProject(teamSlug);
      setSelectedSkill(null);
      setUserInput("");
      const preamble = `[router → ${teamName} via ${routeMode}: ${routeReason}]\n`;
      void dispatchRun({
        teamSlug,
        prompt,
        assignee: "user",
        preamble,
      });
    },
    [dispatchRun, handleSelectProject]
  );

  return (
    <>
      <aside className="border border-border rounded-lg bg-card overflow-hidden">
        <SkillsRail
          skills={skills}
          projects={projects}
          selectedSkill={selectedSkill}
          selectedProject={selectedProject}
          onSelectSkill={setSelectedSkill}
          onSelectProject={handleSelectProject}
        />
      </aside>
      <section className="flex flex-col gap-3 overflow-hidden">
        <RouterPanel running={running} onDispatch={onRouted} />
        <div className="border border-border rounded-lg bg-card flex flex-col overflow-hidden flex-1 min-h-0">
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
              onClearProject={() => handleSelectProject(null)}
            />
          </div>
          <div className="flex-1 min-h-0">
            <OutputStream events={events} />
          </div>
        </div>
      </section>
    </>
  );
}
