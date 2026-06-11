"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/common/Button";
import { Field, Textarea } from "@/components/common/Field";
import { useStream } from "@/hooks/useStream";
import type { CreateJob } from "@/lib/createProject/jobs";
import { StepChecklist } from "@/components/create/StepChecklist";
import { SuccessPanel } from "@/components/create/SuccessPanel";

interface RuntimeOption {
  id: string;
  displayName: string;
}

type Visibility = "private" | "public" | "local-only";

const selectBase =
  "w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export function CreateProjectWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobIdParam = searchParams.get("job");

  const [prompt, setPrompt] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [runtimeDefault, setRuntimeDefault] = useState("claude-code");
  const [fileIssues, setFileIssues] = useState(true);

  const [runtimes, setRuntimes] = useState<RuntimeOption[]>([]);
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [job, setJob] = useState<CreateJob | null>(null);
  const [jobLost, setJobLost] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form metadata: available runtimes + where the repo folder will land.
  useEffect(() => {
    fetch("/api/runtimes")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.runtimes ?? []).map((r: { id: string; displayName: string }) => ({
          id: r.id,
          displayName: r.displayName,
        }));
        setRuntimes(list);
      })
      .catch(() => setRuntimes([{ id: "claude-code", displayName: "Claude Code" }]));
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setWorkspaceRoot(d.workspaceRoot ?? null))
      .catch(() => setWorkspaceRoot(null));
  }, []);

  const hydrateJob = useCallback((id: string) => {
    fetch(`/api/projects/create/${id}`)
      .then((r) => {
        if (r.status === 404) {
          setJobLost(true);
          setJob(null);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d?.job) {
          setJob(d.job);
          setJobLost(false);
        }
      })
      .catch(() => setJobLost(true));
  }, []);

  // Refresh / direct-link with ?job=<id>.
  useEffect(() => {
    if (jobIdParam) hydrateJob(jobIdParam);
  }, [jobIdParam, hydrateJob]);

  // Live progress. Step events carry deltas; refetch on done for the full result.
  useStream((ev) => {
    if (!jobIdParam) return;
    if (ev.kind === "project.create.progress" && ev.jobId === jobIdParam) {
      setJob((prev) => {
        if (!prev) return prev;
        const steps = prev.steps.map((s) =>
          s.id === ev.step
            ? { ...s, status: ev.status as typeof s.status, detail: ev.detail as string | undefined, error: ev.error as string | undefined }
            : s
        );
        return { ...prev, steps };
      });
      // Detail fields (warnings, created slugs) accumulate server-side.
      hydrateJob(jobIdParam);
    }
    if (ev.kind === "project.create.done" && ev.jobId === jobIdParam) {
      hydrateJob(jobIdParam);
    }
  });

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, visibility, runtimeDefault, fileIssues }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.jobId) {
        setError("A create job is already running; showing it.");
        router.replace(`/new?job=${data.jobId}`);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      router.replace(`/new?job=${data.jobId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setJob(null);
    setJobLost(false);
    setError(null);
    router.replace("/new");
  }

  // --- job views ---
  if (jobIdParam && jobLost) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          This job is no longer tracked (the dev server probably restarted). Check{" "}
          <a className="text-blue-600 hover:underline" href="/">Dashboard</a>,{" "}
          <a className="text-blue-600 hover:underline" href="/agents">Agents</a> and the target
          folder for what was created.
        </p>
        <Button onClick={reset}>Back to the form</Button>
      </div>
    );
  }

  if (jobIdParam && job) {
    if (job.status === "running") {
      return (
        <div className="space-y-6">
          <StepChecklist steps={job.steps} />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Safe to navigate away; come back via this URL. The draft step costs one headless
            Claude call.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <StepChecklist steps={job.steps} />
        <SuccessPanel job={job} onReset={reset} />
      </div>
    );
  }

  if (jobIdParam && !job) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading job...</p>;
  }

  // --- form ---
  const canSubmit = prompt.trim().length >= 10 && !submitting;
  return (
    <div className="space-y-5">
      <Field
        label="What should this project be?"
        hint="One or two sentences. The orchestrator names the project, drafts 2-4 agents, and writes kickoff tasks from this."
      >
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Build a CLI tool that tracks my reading list and syncs highlights to the vault..."
          rows={5}
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="GitHub repo" hint="local-only skips repo creation">
          <select
            className={selectBase}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
          >
            <option value="private">Private repo</option>
            <option value="public">Public repo</option>
            <option value="local-only">Local only (no GitHub)</option>
          </select>
        </Field>
        <Field label="Default runtime" hint="Agents may override per profile">
          <select
            className={selectBase}
            value={runtimeDefault}
            onChange={(e) => setRuntimeDefault(e.target.value)}
          >
            {runtimes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.displayName}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={fileIssues}
          onChange={(e) => setFileIssues(e.target.checked)}
          className="rounded border-gray-300 dark:border-gray-700"
        />
        File kickoff issues in the backlog
      </label>

      <div className="rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          New repo folder is created in{" "}
          <span className="font-mono">{workspaceRoot ?? "(loading settings...)"}</span>
          {" - "}change <span className="font-medium">workspaceRoot</span> in{" "}
          <a className="text-blue-600 hover:underline" href="/settings">Settings</a>.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button variant="primary" onClick={submit} disabled={!canSubmit}>
        {submitting ? "Starting..." : "Create project"}
      </Button>
    </div>
  );
}
