"use client";

// Ported from .design-handoff/project/dashboard.jsx.
// Overhauled home: cosmic hero, Delegate composer, KPIs, project list,
// recent runs stream, live-agents rail, usage, vault recents, shortcuts.

import { useState } from "react";
import {
  Avatar,
  SectionHead,
  SkillChip,
  Sparkline,
} from "@/components/design/atoms";
import { I } from "@/components/design/icons";
import {
  ISSUES,
  PROJECTS,
  RECENT_RUNS,
  VAULT_RECENT,
  type RecentRun,
  type VaultItem,
} from "@/lib/design/data";
import type { ViewKey } from "@/components/design/app-shell";

type Props = {
  onOpenIssue: (id: string) => void;
  onNavigate: (view: ViewKey) => void;
};

export function DashboardScreen({ onOpenIssue, onNavigate }: Props) {
  const running = ISSUES.filter((i) => i.status === "running");
  const totalBurn24h = 6.42;
  const tokens24h = 184320;
  const runsToday = 14;

  const [prompt, setPrompt] = useState("");
  const [routedTo, setRoutedTo] = useState<
    "auto" | "researcher" | "coder" | "writer" | "ops"
  >("auto");

  return (
    <div className="dash">
      {/* MAIN COLUMN */}
      <div className="dash-main">
        <section className="panel hero-panel">
          <div className="hero-content">
            <div className="hero-eyebrow">N 44.3894° · W 79.6903° · BARRIE</div>
            <h1 className="hero-title">Good evening, TJ.</h1>
            <p className="hero-tagline">
              Three agents are running, six issues are queued, and the vault has
              four new raw notes since your last sweep.{" "}
              <span style={{ color: "var(--ember-soft)" }}>
                Ad astra per aspera.
              </span>
            </p>
            <div className="hero-coords">
              <div>
                <div className="hero-coord-label">Running</div>
                <div className="hero-coord-value">
                  {running.length}
                  <span className="unit">agents</span>
                </div>
              </div>
              <div>
                <div className="hero-coord-label">Burn · 24h</div>
                <div className="hero-coord-value">${totalBurn24h.toFixed(2)}</div>
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
              <button className="btn">
                <I.spark size={12} /> File as issue
              </button>
              <button className="btn btn-primary">
                <I.bolt size={12} /> Run now
              </button>
            </div>
          </div>
        </section>

        <section>
          <SectionHead title="System Pulse" meta="LAST 7 DAYS" />
          <div className="kpi-grid">
            <Kpi label="Throughput" value="38" unit="runs" delta="+12% wk" deltaPos />
            <Kpi label="Avg cost / run" value="$0.34" delta="-8% wk" deltaPos />
            <Kpi label="Hand-offs" value="11" unit="to agent" delta="+3" deltaPos />
            <Kpi label="Failure rate" value="4.8" unit="%" delta="-1.2pp" deltaPos />
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
          <ProjectList onNavigate={onNavigate} />
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
            {RECENT_RUNS.slice(0, 8).map((r) => (
              <RunRow key={r.id} run={r} onOpenIssue={onOpenIssue} />
            ))}
          </div>
        </section>
      </div>

      {/* RAIL */}
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
              {running.length} LIVE
            </span>
          </div>
          {running.map((i) => (
            <div
              key={i.id}
              className="list-row"
              style={{ alignItems: "flex-start" }}
              onClick={() => onOpenIssue(i.id)}
            >
              <Avatar handle={i.assignee} size={28} running />
              <div className="col grow">
                <div className="row" style={{ gap: 6, fontSize: 11 }}>
                  <span style={{ color: "var(--text-soft)", fontWeight: 600 }}>
                    @{i.assignee}
                  </span>
                  <span className="dim">·</span>
                  <span className="dim font-mono">{i.id}</span>
                </div>
                <div
                  className="truncate"
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  {i.title}
                </div>
                <div className="row" style={{ gap: 6, marginTop: 4 }}>
                  <span className="cost" style={{ fontSize: 10.5 }}>
                    ${i.cost.toFixed(2)}
                  </span>
                  <span className="dim" style={{ fontSize: 10 }}>
                    · {i.live?.tool}
                  </span>
                  <span className="grow" />
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--status-running)",
                    }}
                  >
                    {i.live?.tokensPerSec} t/s
                  </span>
                </div>
              </div>
            </div>
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
              <div className="hero-coord-value">$2.42</div>
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
            <span>104.3k in</span>
            <span className="grow" />
            <span>62.8k out</span>
          </div>
          <div className="row" style={{ marginTop: 8, gap: 6 }}>
            <UsageBar pct={32} label="researcher" color="var(--dept-research)" />
            <UsageBar pct={48} label="coder" color="var(--dept-coding)" />
            <UsageBar pct={12} label="ops" color="var(--dept-productivity)" />
            <UsageBar pct={8} label="writer" color="var(--dept-content)" />
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Vault</span>
            <span className="panel-sub">recent changes</span>
          </div>
          {VAULT_RECENT.map((v, i) => (
            <VaultRow key={i} item={v} />
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
  delta,
  deltaPos,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaPos?: boolean;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {delta && (
        <div
          className={
            "kpi-delta " + (deltaPos ? "kpi-delta-up" : "kpi-delta-down")
          }
        >
          {deltaPos ? "▲" : "▼"} {delta}
        </div>
      )}
    </div>
  );
}

function ProjectList({ onNavigate }: { onNavigate: (view: ViewKey) => void }) {
  const projects = PROJECTS.filter((p) => p.active);
  return (
    <div className="list">
      {projects.map((p) => {
        const openIssues = ISSUES.filter((i) =>
          ["backlog", "queued", "running", "review"].includes(i.status),
        );
        const count = p.slug === "agentic-os" ? openIssues.length : p.open;
        return (
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
            <span
              className="muted font-mono"
              style={{ fontSize: 11 }}
            >
              {count} open
            </span>
            <I.chevronRight size={12} style={{ color: "var(--text-dim)" }} />
          </div>
        );
      })}
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
          @{run.agent} · {run.started}
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
        {item.changed}
      </span>
    </div>
  );
}

function UsageBar({
  pct,
  label,
  color,
}: {
  pct: number;
  label: string;
  color: string;
}) {
  return (
    <div className="col" style={{ flex: 1, gap: 3 }}>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: "rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: pct + "%",
            height: "100%",
            background: color,
            opacity: 0.85,
          }}
        />
      </div>
      <div
        style={{
          fontSize: 9.5,
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.08em",
        }}
      >
        {label} · {pct}%
      </div>
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
