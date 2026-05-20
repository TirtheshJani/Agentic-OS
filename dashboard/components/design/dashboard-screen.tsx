"use client";

import { useEffect, useState } from "react";
import {
  Avatar,
  SectionHead,
  SkillChip,
  Sparkline,
} from "@/components/design/atoms";
import { I } from "@/components/design/icons";
import type {
  DashboardData,
  OpenIssueCount,
  Project,
  RecentRun,
  RunningAgent,
  VaultItem,
} from "@/lib/design/types";
import type { ViewKey } from "@/components/design/app-shell";

type Props = {
  onOpenIssue: (id: string) => void;
  onNavigate: (view: ViewKey) => void;
};

type RouteKey = "auto" | "researcher" | "coder" | "writer" | "ops";

type SubmitState =
  | { kind: "idle" }
  | { kind: "queued" }
  | { kind: "error"; message: string };

const POLL_INTERVAL_MS = 30_000;

export function DashboardScreen({ onOpenIssue, onNavigate }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [prompt, setPrompt] = useState("");
  const [routedTo, setRoutedTo] = useState<RouteKey>("auto");
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/dashboard/data", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as DashboardData;
        if (!cancelled) setData(j);
      } catch {}
    };
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (submitState.kind !== "queued") return;
    const id = setTimeout(() => setSubmitState({ kind: "idle" }), 2000);
    return () => clearTimeout(id);
  }, [submitState]);

  if (!data) {
    return <DashboardSkeleton />;
  }

  const totalOpen = data.openIssueCounts.reduce((s, p) => s + p.open, 0);
  const vaultRecentCount = data.vaultRecents.length;
  const runningCount = data.heroMetrics.runningAgents;
  const burn24h = data.heroMetrics.burn24h;
  const tokens24h = data.heroMetrics.tokens24h;
  const runsToday = data.heroMetrics.runsToday;

  const submit = async () => {
    const text = prompt.trim();
    if (!text) return;
    setSubmitState({ kind: "idle" });
    try {
      let res: Response;
      if (routedTo === "auto") {
        res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        });
      } else {
        res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            assignee: routedTo,
            status: "queued",
          }),
        });
      }
      if (!res.ok) {
        let msg = `submit failed (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) msg = body.error;
        } catch {}
        setSubmitState({ kind: "error", message: msg });
        return;
      }
      setPrompt("");
      setSubmitState({ kind: "queued" });
    } catch (e) {
      setSubmitState({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <div className="dash">
      <div className="dash-main">
        <section className="panel hero-panel">
          <div className="hero-content">
            <div className="hero-eyebrow">N 44.3894° · W 79.6903° · BARRIE</div>
            <h1 className="hero-title">Good evening, TJ.</h1>
            <p className="hero-tagline">
              {runningCount} {pluralize(runningCount, "agent")}{" "}
              {runningCount === 1 ? "is" : "are"} running, {totalOpen}{" "}
              {pluralize(totalOpen, "issue")}{" "}
              {totalOpen === 1 ? "is" : "are"} queued, and the vault has{" "}
              {vaultRecentCount} new{" "}
              {pluralize(vaultRecentCount, "note")} since your last sweep.{" "}
              <span style={{ color: "var(--ember-soft)" }}>
                Ad astra per aspera.
              </span>
            </p>
            <div className="hero-coords">
              <div>
                <div className="hero-coord-label">Running</div>
                <div className="hero-coord-value">
                  {runningCount}
                  <span className="unit">agents</span>
                </div>
              </div>
              <div>
                <div className="hero-coord-label">Burn · 24h</div>
                <div className="hero-coord-value">${burn24h.toFixed(2)}</div>
              </div>
              <div>
                <div className="hero-coord-label">Tokens · 24h</div>
                <div className="hero-coord-value">
                  {(tokens24h / 1000).toFixed(1)}
                  <span className="unit">k</span>
                </div>
              </div>
              <div>
                <div className="hero-coord-label">Runs today</div>
                <div className="hero-coord-value">{runsToday}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Delegate</span>
            <span className="panel-sub">/ free-form prompt or pick a skill</span>
            <span className="grow" />
            <span className="t-coord">CMD + ENTER TO RUN</span>
          </div>
          <div className="composer">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="What needs doing?   e.g. 'Summarize this week's FHIR-RAG arXiv finds into vault/wiki/' or '/lit-review topic: stellar interpretability'"
            />
            <div className="composer-foot">
              <div className="chip-row">
                <RouteChip
                  label="Auto-route"
                  active={routedTo === "auto"}
                  onClick={() => setRoutedTo("auto")}
                />
                <RouteChip
                  label="@researcher"
                  active={routedTo === "researcher"}
                  onClick={() => setRoutedTo("researcher")}
                />
                <RouteChip
                  label="@coder"
                  active={routedTo === "coder"}
                  onClick={() => setRoutedTo("coder")}
                />
                <RouteChip
                  label="@writer"
                  active={routedTo === "writer"}
                  onClick={() => setRoutedTo("writer")}
                />
                <RouteChip
                  label="@ops"
                  active={routedTo === "ops"}
                  onClick={() => setRoutedTo("ops")}
                />
              </div>
              <span className="grow" />
              {submitState.kind === "queued" && (
                <span
                  className="pill pill-good"
                  style={{ animation: "fadeOut 2s forwards" }}
                >
                  Queued
                </span>
              )}
              {submitState.kind === "error" && (
                <span
                  className="pill"
                  style={{
                    color: "var(--urgent)",
                    borderColor: "var(--urgent)",
                  }}
                  title={submitState.message}
                >
                  {submitState.message.slice(0, 60)}
                </span>
              )}
              <button className="btn" onClick={() => void submit()}>
                <I.spark size={12} /> File as issue
              </button>
              <button className="btn btn-primary" onClick={() => void submit()}>
                <I.bolt size={12} /> Run now
              </button>
            </div>
          </div>
          <style>{`@keyframes fadeOut { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }`}</style>
        </section>

        <section>
          <SectionHead title="System Pulse" meta="LAST 7 DAYS" />
          <div className="kpi-grid">
            <Kpi label="Throughput" value={String(runsToday)} unit="runs" />
            <Kpi
              label="Avg cost / run"
              value={
                runsToday > 0
                  ? `$${(burn24h / runsToday).toFixed(2)}`
                  : "$0.00"
              }
            />
            <Kpi
              label="Hand-offs"
              value={String(data.runningAgents.length)}
              unit="live"
            />
            <Kpi
              label="Open issues"
              value={String(totalOpen)}
              unit="across projects"
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Open Issues by Project</span>
            <span className="grow" />
            <button
              className="btn btn-ghost"
              onClick={() => onNavigate("issues")}
            >
              All issues <I.chevronRight size={12} />
            </button>
          </div>
          <ProjectList
            projects={data.projects}
            openCounts={data.openIssueCounts}
            onNavigate={onNavigate}
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Recent Runs</span>
            <span className="grow" />
            <button className="btn btn-ghost">
              Stream <I.chevronRight size={12} />
            </button>
          </div>
          <div className="list">
            {data.recentRuns.length === 0 && (
              <div
                className="dim"
                style={{ fontSize: 11.5, padding: "8px 4px" }}
              >
                No runs yet.
              </div>
            )}
            {data.recentRuns.slice(0, 8).map((r) => (
              <RunRow key={r.id} run={r} onOpenIssue={onOpenIssue} />
            ))}
          </div>
        </section>
      </div>

      <div className="dash-rail">
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Agents at Work</span>
            <span className="grow" />
            <span className="pill pill-good">
              <span
                className="dot blink"
                style={{ background: "var(--status-running)" }}
              />{" "}
              {data.runningAgents.length} LIVE
            </span>
          </div>
          {data.runningAgents.length === 0 && (
            <div
              className="dim"
              style={{ fontSize: 11.5, padding: "8px 4px" }}
            >
              No agents running.
            </div>
          )}
          {data.runningAgents.map((a) => (
            <RunningAgentRow
              key={a.taskId}
              agent={a}
              onOpenIssue={onOpenIssue}
            />
          ))}
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Usage</span>
            <span className="panel-sub">today</span>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <div className="col grow">
              <div className="hero-coord-label">Total spend</div>
              <div className="hero-coord-value">${burn24h.toFixed(2)}</div>
              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                of $20.00 monthly
              </div>
            </div>
            <Sparkline
              values={[2, 3, 5, 4, 7, 9, 6, 8, 10, 12, 9, 11]}
              width={120}
              height={36}
            />
          </div>
          <hr className="hr" />
          <div className="row" style={{ fontSize: 11, color: "var(--text-muted)" }}>
            <span>{Math.round(tokens24h / 1000)}k total</span>
            <span className="grow" />
            <span>{runsToday} runs</span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Vault</span>
            <span className="panel-sub">recent changes</span>
          </div>
          {data.vaultRecents.length === 0 && (
            <div
              className="dim"
              style={{ fontSize: 11.5, padding: "8px 4px" }}
            >
              No recent changes.
            </div>
          )}
          {data.vaultRecents.map((v, i) => (
            <VaultRow key={`${v.path}-${i}`} item={v} />
          ))}
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Shortcuts</span>
          </div>
          <Shortcut label="New issue" combo={["C"]} />
          <Shortcut label="Quick run" combo={["⌘", "K"]} />
          <Shortcut label="Go to board" combo={["G", "B"]} />
          <Shortcut label="Search vault" combo={["⌘", "/"]} />
        </section>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dash">
      <div className="dash-main">
        <section className="panel hero-panel">
          <div className="hero-content">
            <div className="hero-eyebrow">N 44.3894° · W 79.6903° · BARRIE</div>
            <h1 className="hero-title">Loading…</h1>
            <p className="hero-tagline dim">Loading dashboard data…</p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Delegate</span>
          </div>
          <div className="dim" style={{ padding: 12, fontSize: 11.5 }}>
            Loading…
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Recent Runs</span>
          </div>
          <div className="dim" style={{ padding: 12, fontSize: 11.5 }}>
            Loading…
          </div>
        </section>
      </div>
      <div className="dash-rail">
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Agents at Work</span>
          </div>
          <div className="dim" style={{ padding: 12, fontSize: 11.5 }}>
            Loading…
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Vault</span>
          </div>
          <div className="dim" style={{ padding: 12, fontSize: 11.5 }}>
            Loading…
          </div>
        </section>
      </div>
    </div>
  );
}

function RouteChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={"pill " + (active ? "pill-ember" : "")}
      style={{
        cursor: "pointer",
        background: active
          ? "rgba(74,143,209,0.14)"
          : "rgba(255,255,255,0.03)",
        border: active
          ? "1px solid rgba(74,143,209,0.35)"
          : "1px solid var(--border)",
      }}
    >
      {label}
    </button>
  );
}

function Kpi({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
}

function ProjectList({
  projects,
  openCounts,
  onNavigate,
}: {
  projects: Project[];
  openCounts: OpenIssueCount[];
  onNavigate: (view: ViewKey) => void;
}) {
  const active = projects.filter((p) => p.active);
  const countBySlug = new Map(openCounts.map((c) => [c.slug, c.open]));
  if (active.length === 0) {
    return (
      <div className="dim" style={{ fontSize: 11.5, padding: "8px 4px" }}>
        No active projects.
      </div>
    );
  }
  return (
    <div className="list">
      {active.map((p) => (
        <div
          key={p.slug}
          className="list-row"
          onClick={() => onNavigate("issues")}
        >
          <span
            className="dept-dot"
            style={{
              width: 8,
              height: 8,
              background: p.color,
              boxShadow: `0 0 6px ${p.color}80`,
            }}
          />
          <span
            className="grow"
            style={{ fontSize: 12.5, color: "var(--text-soft)" }}
          >
            {p.name}
          </span>
          <span className="muted font-mono" style={{ fontSize: 11 }}>
            {countBySlug.get(p.slug) ?? 0} open
          </span>
          <I.chevronRight size={12} style={{ color: "var(--text-dim)" }} />
        </div>
      ))}
    </div>
  );
}

function RunRow({
  run,
  onOpenIssue,
}: {
  run: RecentRun;
  onOpenIssue: (id: string) => void;
}) {
  const isRunning = run.status === "running";
  return (
    <div
      className="run-row"
      onClick={() => run.issue && onOpenIssue(run.issue)}
      style={{ cursor: run.issue ? "pointer" : "default" }}
    >
      <Avatar handle={run.agent} size={20} running={isRunning} />
      <div className="col" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="run-id">{run.id}</span>
          <SkillChip name={run.skill} />
          {run.issue && (
            <span className="dim font-mono" style={{ fontSize: 10.5 }}>
              · {run.issue}
            </span>
          )}
        </div>
        <div className="run-title truncate">
          @{run.agent} · {relTime(run.started)}
        </div>
      </div>
      <span className="run-duration">{run.duration}</span>
      <span className="cost">${run.cost.toFixed(2)}</span>
      <span className={"pill " + (isRunning ? "pill-good" : "")}>
        {isRunning ? (
          <>
            <span
              className="dot blink"
              style={{ background: "var(--status-running)" }}
            />{" "}
            LIVE
          </>
        ) : (
          <span className="dim">DONE</span>
        )}
      </span>
    </div>
  );
}

function RunningAgentRow({
  agent,
  onOpenIssue,
}: {
  agent: RunningAgent;
  onOpenIssue: (id: string) => void;
}) {
  const handle = agent.agent ?? "agent";
  const startedLabel = agent.startedAtIso ? relTime(agent.startedAtIso) : "—";
  return (
    <div
      className="list-row"
      style={{ alignItems: "flex-start", cursor: "pointer" }}
      onClick={() => onOpenIssue(String(agent.taskId))}
    >
      <Avatar handle={handle} size={28} running />
      <div className="col grow">
        <div className="row" style={{ gap: 6, fontSize: 11 }}>
          <span style={{ color: "var(--text-soft)", fontWeight: 600 }}>
            @{handle}
          </span>
          <span className="dim">·</span>
          <span className="dim font-mono">#{agent.taskId}</span>
        </div>
        <div
          className="truncate"
          style={{
            fontSize: 11.5,
            color: "var(--text-muted)",
            marginTop: 2,
          }}
        >
          {agent.title}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 4 }}>
          <span className="cost" style={{ fontSize: 10.5 }}>
            ${agent.costSoFar.toFixed(2)}
          </span>
          <span className="dim" style={{ fontSize: 10 }}>
            · {startedLabel}
          </span>
          <span className="grow" />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--status-running)",
            }}
          >
            {Math.round((agent.tokensIn + agent.tokensOut) / 1000)}k tok
          </span>
        </div>
      </div>
    </div>
  );
}

function VaultRow({ item }: { item: VaultItem }) {
  const kindColor =
    (
      {
        raw: "var(--text-dim)",
        wiki: "var(--ember)",
        thread: "var(--azure)",
        output: "var(--teal)",
      } as const
    )[item.kind] || "var(--text-dim)";
  return (
    <div className="list-row" style={{ padding: "6px 6px" }}>
      <span
        className="pill pill-mono"
        style={{ color: kindColor, borderColor: `${kindColor}40` }}
      >
        {item.kind}
      </span>
      <span
        className="font-mono grow truncate"
        style={{ fontSize: 11, color: "var(--text-soft)" }}
      >
        {item.path}
      </span>
      <span className="dim" style={{ fontSize: 10.5 }}>
        {relTime(item.changed)}
      </span>
    </div>
  );
}

function Shortcut({ label, combo }: { label: string; combo: string[] }) {
  return (
    <div
      className="row"
      style={{
        justifyContent: "space-between",
        fontSize: 11.5,
        padding: "4px 0",
      }}
    >
      <span className="muted">{label}</span>
      <span>
        {combo.map((c, i) => (
          <span key={i}>
            {i > 0 ? " " : ""}
            <span className="kbd">{c}</span>
          </span>
        ))}
      </span>
    </div>
  );
}

function pluralize(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}

function relTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  if (hr < 48) return "yest";
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}
