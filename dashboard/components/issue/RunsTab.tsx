"use client";
import { useState, useEffect, useCallback } from "react";
import { useRunsForIssue } from "@/hooks/useRun";
import { useRuntimes } from "@/hooks/useRuntimes";
import { RunTerminal } from "./RunTerminal";
import { RunHeader } from "./RunHeader";
import { StartButton } from "./StartButton";
import { StopButton } from "./StopButton";
import { Select } from "@/components/common/Select";
import { RuntimeBadge } from "@/components/common/RuntimeBadge";

interface Props {
  issueId: number;
  projectSlug: string;
  issueStatus: "backlog" | "queued" | "running" | "review" | "done" | "failed";
  hasAssignee: boolean;
}

interface CapState {
  projectActive: number;
  globalActive: number;
}

interface CapLimits {
  perProjectMax: number;
  globalMax: number;
}

export function RunsTab({ issueId, projectSlug, issueStatus, hasAssignee }: Props) {
  const { runs, reload } = useRunsForIssue(issueId);
  const runtimes = useRuntimes();
  const [capStatus, setCapStatus] = useState<CapState | null>(null);
  const [capLimits, setCapLimits] = useState<CapLimits | null>(null);
  // "" means "agent default": no override sent with the start request.
  const [runtimeOverride, setRuntimeOverride] = useState("");

  const refreshCaps = useCallback(async () => {
    if (!projectSlug) return;
    try {
      const [capRes, settingsRes] = await Promise.all([
        fetch(`/api/projects/${projectSlug}/capacity`, { cache: "no-store" }),
        fetch(`/api/settings`, { cache: "no-store" }),
      ]);
      if (capRes.ok) setCapStatus(await capRes.json());
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setCapLimits({
          perProjectMax: s.concurrency.perProjectMax,
          globalMax: s.concurrency.globalMax,
        });
      }
    } catch (err) {
      console.error("Failed to refresh capacity status:", err);
    }
  }, [projectSlug]);

  useEffect(() => {
    refreshCaps();
  }, [refreshCaps, runs?.length]);

  if (!runs) return <p className="text-sm text-ink3">Loading runs...</p>;

  const activeRun = runs.find(r => r.endedAt == null);

  const atProjectCap = capLimits != null && capStatus != null && capStatus.projectActive >= capLimits.perProjectMax;
  const atGlobalCap = capLimits != null && capStatus != null && capStatus.globalActive >= capLimits.globalMax;

  const capReason = atProjectCap
    ? `At project concurrency cap (${capStatus!.projectActive}/${capLimits!.perProjectMax})`
    : atGlobalCap
    ? `At global concurrency cap (${capStatus!.globalActive}/${capLimits!.globalMax})`
    : null;

  const startDisabled =
    !hasAssignee ||
    activeRun != null ||
    issueStatus === "done" ||
    capReason != null;

  const disabledReason = !hasAssignee
    ? "Assign an agent before starting"
    : activeRun != null
    ? "Run already in progress"
    : issueStatus === "done"
    ? "Issue is marked done"
    : capReason;

  async function openInTerminal(runId: number) {
    try {
      const res = await fetch(`/api/runs/${runId}/open-terminal`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Failed to open terminal: ${data.error ?? res.status}`);
      }
    } catch (err) {
      console.error("Failed to open terminal:", err);
      alert("Failed to open terminal: Network error");
    }
  }

  function onStarted() {
    reload();
    refreshCaps();
  }

  function onStopped() {
    reload();
    refreshCaps();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface2 px-3 py-2.5">
        <div className="flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.16em] text-ink3">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          {runs.length === 0 ? "No runs yet" : `${runs.length} run${runs.length === 1 ? "" : "s"}`}
        </div>
        <div className="flex items-center gap-2">
          {activeRun && <StopButton runId={activeRun.id} onStopped={onStopped} />}
          {!activeRun && runtimes && runtimes.length > 1 && (
            <Select
              size="sm"
              value={runtimeOverride}
              onChange={(e) => setRuntimeOverride(e.target.value)}
              title="Runtime for the next run"
            >
              <option value="">Agent default</option>
              {runtimes.map((rt) => (
                <option key={rt.id} value={rt.id} disabled={!rt.availability.available}>
                  {rt.displayName}{rt.availability.available ? "" : " (not installed)"}
                </option>
              ))}
            </Select>
          )}
          <StartButton
            issueId={issueId}
            disabled={startDisabled}
            disabledReason={disabledReason}
            runtimeId={runtimeOverride || undefined}
            onStarted={onStarted}
          />
        </div>
      </div>

      {activeRun && (
        <section>
          <RunHeader run={activeRun} onOpenInTerminal={() => openInTerminal(activeRun.id)} />
          <RunTerminal runId={activeRun.id} active />
        </section>
      )}

      {runs.filter(r => r.endedAt != null).length > 0 && (
        <section>
          <h4 className="font-label text-[10px] uppercase tracking-[0.14em] text-ink3 mb-2">Previous runs</h4>
          <ul className="space-y-1.5">
            {runs.filter(r => r.endedAt != null).map(r => {
              const ok = r.exitStatus === "done";
              const failed = r.exitStatus === "failed";
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded-card border border-line bg-surface2 px-3 py-2 text-xs"
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? "bg-ok" : failed ? "bg-danger" : "bg-ink3"}`}
                  />
                  <span className="font-mono text-ink3">#{r.id}</span>
                  <RuntimeBadge runtimeId={r.runtimeId} />
                  <span className={`font-label uppercase tracking-wide text-[10px] ${ok ? "text-ok" : failed ? "text-danger" : "text-ink2"}`}>
                    {r.exitStatus ?? "ended"}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-ink3">
                    {new Date(r.startedAt).toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
