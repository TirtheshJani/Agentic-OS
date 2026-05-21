"use client";

// Phase 9.5/9.6: Inbox, MyIssues, Agents, Skills/Runtimes, Settings.
// Each screen pulls from its API route. No mock data imports.

import { useEffect, useState } from "react";
import {
  Avatar,
  CostMeter,
  DeptTag,
  PriorityChip,
  SectionHead,
  StatusDot,
} from "@/components/design/atoms";
import { I } from "@/components/design/icons";
import { deptOf, type Agent, type InboxItem, type Issue, type Settings, type Skill } from "@/lib/design/types";
import { POLL_INTERVAL_MS } from "@/lib/design/constants";

/* ---------- AGENTS ---------- */
export function AgentsScreen() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agents", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as Agent[];
        if (!cancelled) setAgents(j);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/issues", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as Issue[];
        if (!cancelled) setIssues(j);
      } catch {}
    };
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!agents) {
    return <LoadingScreen label="Loading agents…" />;
  }

  return (
    <div className="agents-grid">
      {agents
        .filter((a) => a.kind === "agent")
        .map((a) => {
          const mine = issues.filter((i) => i.assignee === a.handle);
          const open = mine.filter(
            (i) => i.status !== "done" && i.status !== "failed",
          ).length;
          const running = mine.filter((i) => i.status === "running").length;
          const totalCost = mine.reduce((s, i) => s + (i.cost || 0), 0);
          return (
            <article key={a.handle} className="agent-card">
              {running > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    fontSize: 9.5,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "var(--status-running)",
                    fontFamily: "var(--font-mono)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    className="dot blink"
                    style={{ background: "var(--status-running)" }}
                  />{" "}
                  Live
                </span>
              )}
              <div className="agent-card-head">
                <Avatar handle={a.handle} size={42} running={running > 0} />
                <div className="col">
                  <span className="agent-card-name">{a.name}</span>
                  <span className="agent-card-handle">@{a.handle}</span>
                </div>
              </div>
              <DeptTag dept={a.dept} />
              <p
                style={{
                  fontSize: 11.5,
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {a.description ?? "Specialized agent."}
              </p>
              <div className="agent-card-stats">
                <div className="agent-stat">
                  <span className="agent-stat-label">Open</span>
                  <span className="agent-stat-value">{open}</span>
                </div>
                <div className="agent-stat">
                  <span className="agent-stat-label">7d cost</span>
                  <span className="agent-stat-value">
                    ${totalCost.toFixed(2)}
                  </span>
                </div>
                <div className="agent-stat">
                  <span className="agent-stat-label">Skills</span>
                  <span className="agent-stat-value">
                    {(a.skills ?? []).length}
                  </span>
                </div>
              </div>
              <div className="row" style={{ gap: 4, marginTop: 4 }}>
                <button
                  className="btn"
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  <I.bolt size={12} /> Run
                </button>
                <button
                  className="btn"
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  <I.handoff size={12} /> Hand off
                </button>
              </div>
            </article>
          );
        })}
    </div>
  );
}

/* ---------- SKILLS / RUNTIMES ---------- */
export function SkillsScreen({ mode = "skills" }: { mode?: "skills" | "runtimes" }) {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/skills", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as Skill[];
        if (!cancelled) setSkills(j);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!skills) {
    return <LoadingScreen label="Loading skills…" />;
  }

  // Runtimes view = remote-mode skills grouped by their MCP server. Skills
  // without an MCP server collapse to "(none)".
  const scoped =
    mode === "runtimes"
      ? skills.filter((s) => s.mode === "remote")
      : skills;

  const groupKey = (s: Skill): string =>
    mode === "runtimes" ? s.mcpServer ?? "(none)" : s.family;

  const groups = Array.from(new Set(scoped.map(groupKey)));
  const filtered =
    filter === "all" ? scoped : scoped.filter((s) => groupKey(s) === filter);

  const eyebrow = mode === "runtimes" ? "RUNTIMES · MCP SERVERS" : "SKILLS REGISTRY";
  const groupHeader = mode === "runtimes" ? "Server" : "Family";

  return (
    <div className="screen">
      <div className="board-toolbar">
        <span className="t-eyebrow">{eyebrow}</span>
        <div className="toolbar-spacer" />
        <div className="row" style={{ gap: 4 }}>
          <button
            className={"btn " + (filter === "all" ? "btn-primary" : "")}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          {groups.map((f) => (
            <button
              key={f}
              className={"btn " + (filter === f ? "btn-primary" : "")}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        {mode === "skills" && (
          <button className="btn btn-primary">
            <I.plus size={13} /> New skill
          </button>
        )}
      </div>

      <div
        className="screen-body"
        style={{ padding: "12px 16px", overflowY: "auto" }}
      >
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 220 }}>Skill</th>
              <th style={{ width: 130 }}>{groupHeader}</th>
              <th style={{ width: 90 }}>Cadence</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 70 }}>Runs</th>
              <th style={{ width: 130 }}>Last run</th>
              <th style={{ width: 130 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const isStub = s.status === "stub";
              const groupVal = groupKey(s);
              const deptKey = s.family === "_meta" ? "infra" : s.family;
              return (
                <tr key={s.name}>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <I.skills
                        size={14}
                        style={{
                          color: isStub
                            ? "var(--text-dim)"
                            : "var(--ember)",
                        }}
                      />
                      <span
                        className="font-mono soft"
                        style={{ fontSize: 12 }}
                      >
                        {s.name}
                      </span>
                    </div>
                  </td>
                  <td>
                    {mode === "skills" && deptOf(deptKey) ? (
                      <DeptTag dept={deptKey} />
                    ) : (
                      <span className="dim">{groupVal}</span>
                    )}
                  </td>
                  <td>
                    <span className="pill pill-mono">
                      {s.cadence || "on demand"}
                    </span>
                  </td>
                  <td>
                    {isStub ? (
                      <span className="pill">STUB</span>
                    ) : (
                      <span className="pill pill-good">READY</span>
                    )}
                  </td>
                  <td className="font-mono muted">{s.runs}</td>
                  <td className="font-mono muted" style={{ fontSize: 11 }}>
                    {s.lastRun ? relTime(s.lastRun) : "—"}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn">
                        <I.play size={11} /> Run
                      </button>
                      <button className="btn btn-ghost">
                        <I.edit size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- INBOX ---------- */
export function InboxScreen({
  onOpenIssue,
}: {
  onOpenIssue: (id: string) => void;
}) {
  const [items, setItems] = useState<InboxItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/inbox", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as InboxItem[];
        if (!cancelled) setItems(j);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items) {
    return <LoadingScreen label="Loading inbox…" />;
  }

  return (
    <div className="screen">
      <div className="board-toolbar">
        <span className="t-eyebrow">INBOX · WHAT WANTS MY ATTENTION</span>
        <span className="toolbar-spacer" />
        <span className="toolbar-meta">{items.length} TOTAL</span>
      </div>
      <div
        className="screen-body"
        style={{ padding: "12px 16px", overflowY: "auto" }}
      >
        {items.length === 0 && (
          <div
            className="dim"
            style={{ fontSize: 11.5, padding: "8px 4px" }}
          >
            Inbox empty.
          </div>
        )}
        {items.map((entry) => (
          <InboxRow key={entry.id} entry={entry} onOpenIssue={onOpenIssue} />
        ))}
      </div>
    </div>
  );
}

function inboxTaskId(entry: InboxItem): string | null {
  if (entry.kind !== "backlog-task") return null;
  const m = entry.id.match(/^task-(\d+)$/);
  return m ? m[1] : null;
}

function inboxBorder(kind: InboxItem["kind"]): string {
  if (kind === "failed-run") return "var(--urgent)";
  if (kind === "backlog-task") return "var(--status-review)";
  return "var(--status-backlog)";
}

function inboxLabel(kind: InboxItem["kind"]): string {
  if (kind === "failed-run") return "FAILED";
  if (kind === "backlog-task") return "BACKLOG";
  return "VAULT";
}

function InboxRow({
  entry,
  onOpenIssue,
}: {
  entry: InboxItem;
  onOpenIssue: (id: string) => void;
}) {
  const taskId = inboxTaskId(entry);
  const clickable = taskId !== null;
  return (
    <div
      className="list-row"
      style={{
        padding: "10px 12px",
        borderLeft: `2px solid ${inboxBorder(entry.kind)}`,
        background: "rgba(255,255,255,0.015)",
        borderRadius: "0 6px 6px 0",
        marginBottom: 4,
        cursor: clickable ? "pointer" : "default",
      }}
      onClick={() => taskId && onOpenIssue(taskId)}
    >
      <span className="pill pill-mono">{inboxLabel(entry.kind)}</span>
      <div className="col grow">
        <div
          style={{ fontSize: 12.5, color: "var(--text-soft)" }}
          className="truncate"
        >
          {entry.title}
        </div>
        {entry.subtitle && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--text-muted)",
              marginTop: 2,
            }}
            className="truncate"
          >
            {entry.subtitle}
          </div>
        )}
      </div>
      <span className="dim" style={{ fontSize: 10.5 }}>
        {relTime(entry.tsIso)}
      </span>
      {clickable && (
        <I.chevronRight size={12} style={{ color: "var(--text-dim)" }} />
      )}
    </div>
  );
}

/* ---------- MY ISSUES ---------- */
export function MyIssuesScreen({
  onOpenIssue,
}: {
  onOpenIssue: (id: string) => void;
}) {
  const [issues, setIssues] = useState<Issue[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/issues?assignee=user", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const j = (await res.json()) as Issue[];
        if (!cancelled) setIssues(j);
      } catch {}
    };
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!issues) {
    return <LoadingScreen label="Loading issues…" />;
  }

  return (
    <div className="screen">
      <div className="board-toolbar">
        <span className="t-eyebrow">FILED BY ME · @tj</span>
        <span className="toolbar-spacer" />
        <span className="toolbar-meta">{issues.length} TOTAL</span>
      </div>
      <div
        className="screen-body"
        style={{ padding: "12px 16px", overflowY: "auto" }}
      >
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>ID</th>
              <th>Title</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 100 }}>Priority</th>
              <th style={{ width: 80 }}>Cost</th>
              <th style={{ width: 40 }}>Owner</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((i) => (
              <tr
                key={i.id}
                onClick={() => onOpenIssue(i.id)}
                style={{ cursor: "pointer" }}
              >
                <td className="font-mono dim">{i.id}</td>
                <td className="soft">{i.title}</td>
                <td>
                  <span className="row" style={{ gap: 4 }}>
                    <StatusDot status={i.status} size={10} />
                    <span
                      className="muted"
                      style={{ fontSize: 11, textTransform: "capitalize" }}
                    >
                      {i.status}
                    </span>
                  </span>
                </td>
                <td>
                  <PriorityChip priority={i.priority} />
                </td>
                <td>
                  <CostMeter cost={i.cost} />
                </td>
                <td>
                  <Avatar handle={i.assignee} size={20} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- SETTINGS ---------- */
export function SettingsScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as Settings;
        if (!cancelled) setSettings(j);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!settings) {
    return <LoadingScreen label="Loading settings…" />;
  }

  return (
    <div className="settings-wrap">
      <h1
        className="t-serif"
        style={{ fontSize: 26, marginTop: 0, color: "var(--text-white)" }}
      >
        Settings
      </h1>
      <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
        Read-only · sourced from{" "}
        <span className="font-mono">.agentic-os/state.db</span>,{" "}
        <span className="font-mono">skills/</span>,{" "}
        <span className="font-mono">agents/</span>, and{" "}
        <span className="font-mono">automations/remote/</span>.
      </p>

      <SectionHead title="System" meta="STATE" />
      <SettingRow label="Dashboard version" value={settings.dashboardVersion} />
      <SettingRow
        label="Last vault index"
        value={
          settings.lastVaultIndexAt
            ? relTime(settings.lastVaultIndexAt)
            : "never"
        }
      />

      <SectionHead title="Registry counts" meta="REGISTRY" />
      <SettingRow label="Agents" value={String(settings.agentCount)} />
      <SettingRow label="Skills" value={String(settings.skillCount)} />
      <SettingRow label="Projects" value={String(settings.projectCount)} />
      <SettingRow label="Schedules" value={String(settings.scheduleCount)} />
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="setting-row">
      <div>
        <div className="setting-label">{label}</div>
      </div>
      <span className="font-mono muted" style={{ fontSize: 12 }}>
        {value}
      </span>
    </div>
  );
}

/* ---------- VAULT ---------- */

type VaultChangeRow = {
  id: number;
  path: string;
  kind: "add" | "change" | "unlink";
  ts: number;
};

type VaultRecentResponse = {
  changes: VaultChangeRow[];
};

export function VaultScreen() {
  const [changes, setChanges] = useState<VaultChangeRow[] | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/vault/recent", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setErrored(true);
          return;
        }
        const j = (await res.json()) as VaultRecentResponse;
        if (!cancelled) setChanges(Array.isArray(j.changes) ? j.changes : []);
      } catch {
        if (!cancelled) setErrored(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!changes && !errored) {
    return <LoadingScreen label="Loading vault…" />;
  }

  const rows = (changes ?? []).slice(0, 20);

  return (
    <div className="screen">
      <div className="board-toolbar">
        <span className="t-eyebrow">VAULT · RECENT ACTIVITY</span>
        <span className="toolbar-spacer" />
        <span className="toolbar-meta">{rows.length} ENTRIES</span>
      </div>
      <div
        className="screen-body"
        style={{ padding: "12px 16px", overflowY: "auto" }}
      >
        {errored || rows.length === 0 ? (
          <div
            className="dim"
            style={{ fontSize: 11.5, padding: "8px 4px" }}
          >
            No recent vault activity.
          </div>
        ) : (
          rows.map((c) => (
            <div
              key={c.id}
              className="list-row"
              style={{
                padding: "10px 12px",
                borderLeft: `2px solid ${vaultKindColor(c.kind)}`,
                background: "rgba(255,255,255,0.015)",
                borderRadius: "0 6px 6px 0",
                marginBottom: 4,
              }}
            >
              <span className="pill pill-mono">{c.kind.toUpperCase()}</span>
              <div className="col grow">
                <div
                  style={{ fontSize: 12.5, color: "var(--text-soft)" }}
                  className="truncate"
                >
                  {basename(c.path)}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                  className="truncate"
                >
                  {c.path}
                </div>
              </div>
              <span className="dim" style={{ fontSize: 10.5 }}>
                {relTimeFromMs(c.ts)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function vaultKindColor(kind: VaultChangeRow["kind"]): string {
  if (kind === "add") return "var(--status-done)";
  if (kind === "unlink") return "var(--urgent)";
  return "var(--status-review)";
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

function relTimeFromMs(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  return relTime(new Date(ms).toISOString());
}

/* ---------- shared ---------- */

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="screen">
      <div
        className="dim"
        style={{ padding: 24, fontSize: 12 }}
      >
        {label}
      </div>
    </div>
  );
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
