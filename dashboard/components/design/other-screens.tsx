"use client";

// Ported from .design-handoff/project/other-screens.jsx + the MyIssues screen
// from app.jsx. Inbox, MyIssues, Agents, Skills, Settings.

import { useState } from "react";
import {
  Avatar,
  CostMeter,
  DeptTag,
  PriorityChip,
  SectionHead,
  SkillChip,
  Sparkline,
  StatusDot,
} from "@/components/design/atoms";
import { I } from "@/components/design/icons";
import {
  AGENT_BLURB,
  AGENT_SKILLS,
  AGENTS,
  deptOf,
  ISSUES,
  SKILLS,
  type Issue,
} from "@/lib/design/data";
import { useTweaks, type Tweaks } from "@/components/design/tweaks-panel";

/* ---------- AGENTS ---------- */
export function AgentsScreen() {
  return (
    <div className="agents-grid">
      {AGENTS.filter((a) => a.kind === "agent").map((a) => {
        const open = ISSUES.filter(
          (i) =>
            i.assignee === a.handle &&
            i.status !== "done" &&
            i.status !== "failed",
        ).length;
        const running = ISSUES.filter(
          (i) => i.assignee === a.handle && i.status === "running",
        ).length;
        const allRuns = ISSUES.filter((i) => i.assignee === a.handle);
        const totalCost = allRuns.reduce((s, i) => s + (i.cost || 0), 0);
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
              {AGENT_BLURB[a.handle] || "Specialized agent."}
            </p>
            <div className="agent-card-stats">
              <div className="agent-stat">
                <span className="agent-stat-label">Open</span>
                <span className="agent-stat-value">{open}</span>
              </div>
              <div className="agent-stat">
                <span className="agent-stat-label">7d cost</span>
                <span className="agent-stat-value">
                  ${(totalCost * 1.4).toFixed(2)}
                </span>
              </div>
              <div className="agent-stat">
                <span className="agent-stat-label">Skills</span>
                <span className="agent-stat-value">
                  {AGENT_SKILLS[a.handle]?.length || 0}
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
export function SkillsScreen() {
  const [filter, setFilter] = useState<string>("all");

  const families = Array.from(new Set(SKILLS.map((s) => s.family)));
  const filtered =
    filter === "all" ? SKILLS : SKILLS.filter((s) => s.family === filter);

  // Stable per-skill sparkline values so they do not change on every render.
  const sparkOf = (name: string, seed: number) => {
    const arr: number[] = [];
    let s = seed;
    for (let i = 0; i < 7; i++) {
      s = (s * 9301 + 49297) % 233280;
      arr.push(Math.max(1, Math.floor((s / 233280) * 12) + 1));
    }
    return arr;
  };

  return (
    <div className="screen">
      <div className="board-toolbar">
        <span className="t-eyebrow">SKILLS REGISTRY</span>
        <div className="toolbar-spacer" />
        <div className="row" style={{ gap: 4 }}>
          <button
            className={"btn " + (filter === "all" ? "btn-primary" : "")}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          {families.map((f) => (
            <button
              key={f}
              className={"btn " + (filter === f ? "btn-primary" : "")}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <button className="btn btn-primary">
          <I.plus size={13} /> New skill
        </button>
      </div>

      <div
        className="screen-body"
        style={{ padding: "12px 16px", overflowY: "auto" }}
      >
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 220 }}>Skill</th>
              <th style={{ width: 110 }}>Family</th>
              <th style={{ width: 90 }}>Cadence</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 70 }}>Runs</th>
              <th style={{ width: 110 }}>Last run</th>
              <th>Recent throughput</th>
              <th style={{ width: 130 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, idx) => {
              const isStub = s.status === "stub";
              const sparkVals = isStub
                ? [0, 0, 0, 0, 0, 0, 0]
                : sparkOf(s.name, idx + 1);
              const dept = s.family === "_meta" ? "infra" : s.family;
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
                    {deptOf(dept) ? <DeptTag dept={dept} /> : <span className="dim">{s.family}</span>}
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
                    {s.lastRun}
                  </td>
                  <td>
                    <Sparkline
                      values={sparkVals}
                      width={80}
                      height={14}
                      color={isStub ? "var(--text-dim)" : "var(--ember)"}
                    />
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
export function InboxScreen({ onOpenIssue }: { onOpenIssue: (id: string) => void }) {
  const review = ISSUES.filter((i) => i.status === "review");
  const running = ISSUES.filter((i) => i.status === "running");
  const failed = ISSUES.filter((i) => i.status === "failed");

  return (
    <div className="screen">
      <div className="board-toolbar">
        <span className="t-eyebrow">INBOX · WHAT WANTS MY ATTENTION</span>
        <span className="toolbar-spacer" />
        <button className="btn">Mark all read</button>
      </div>
      <div
        className="screen-body"
        style={{ padding: "12px 16px", overflowY: "auto" }}
      >
        <SectionHead title="Awaiting Review" meta={`${review.length} items`} />
        {review.map((i) => (
          <InboxRow key={i.id} issue={i} onOpen={onOpenIssue} />
        ))}
        <div style={{ height: 18 }} />
        <SectionHead
          title="Live Runs · Heads-up"
          meta={`${running.length} running`}
        />
        {running.map((i) => (
          <InboxRow key={i.id} issue={i} onOpen={onOpenIssue} live />
        ))}
        <div style={{ height: 18 }} />
        <SectionHead title="Recent Failures" meta={`${failed.length} failed`} />
        {failed.map((i) => (
          <InboxRow key={i.id} issue={i} onOpen={onOpenIssue} bad />
        ))}
      </div>
    </div>
  );
}

function InboxRow({
  issue,
  onOpen,
  live,
  bad,
}: {
  issue: Issue;
  onOpen: (id: string) => void;
  live?: boolean;
  bad?: boolean;
}) {
  const borderColor = bad
    ? "var(--urgent)"
    : live
      ? "var(--status-running)"
      : "var(--status-review)";
  return (
    <div
      className="list-row"
      style={{
        padding: "10px 12px",
        borderLeft: `2px solid ${borderColor}`,
        background: "rgba(255,255,255,0.015)",
        borderRadius: "0 6px 6px 0",
        marginBottom: 4,
      }}
      onClick={() => onOpen(issue.id)}
    >
      <Avatar handle={issue.assignee} size={26} running={live} />
      <div className="col grow">
        <div className="row" style={{ gap: 6 }}>
          <span className="issue-id">{issue.id}</span>
          <PriorityChip priority={issue.priority} />
          {issue.skill && <SkillChip name={issue.skill} />}
        </div>
        <div
          style={{ fontSize: 12.5, marginTop: 2, color: "var(--text-soft)" }}
        >
          {issue.title}
        </div>
        {bad && issue.error && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--urgent)",
              marginTop: 3,
            }}
          >
            {issue.error}
          </div>
        )}
        {live && issue.live && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--status-running)",
              marginTop: 3,
            }}
          >
            ⟳ {issue.live.tool} · {issue.live.tokensPerSec} tok/s · $
            {issue.cost.toFixed(2)}
          </div>
        )}
      </div>
      <I.chevronRight size={12} style={{ color: "var(--text-dim)" }} />
    </div>
  );
}

/* ---------- MY ISSUES (originally in app.jsx) ---------- */
export function MyIssuesScreen({ onOpenIssue }: { onOpenIssue: (id: string) => void }) {
  const mine = ISSUES.filter((i) => i.reporter === "tj");
  return (
    <div className="screen">
      <div className="board-toolbar">
        <span className="t-eyebrow">FILED BY ME · @tj</span>
        <span className="toolbar-spacer" />
        <span className="toolbar-meta">{mine.length} TOTAL</span>
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
            {mine.map((i) => (
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
  const { tweaks, setTweak } = useTweaks();

  return (
    <div className="settings-wrap">
      <h1
        className="t-serif"
        style={{ fontSize: 26, marginTop: 0, color: "var(--text-white)" }}
      >
        Settings
      </h1>
      <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
        Local-only · changes write to{" "}
        <span className="font-mono">.agentic-os/state.db</span> and
        <span className="font-mono"> ~/.claude/settings.json</span>.
      </p>

      <SectionHead title="System" meta="DAEMON" />
      <div className="setting-row">
        <div>
          <div className="setting-label">Daemon</div>
          <div className="setting-help">
            Background process that polls the queue and spawns runs.
          </div>
        </div>
        <span className="pill pill-good">
          <span
            className="dot"
            style={{ background: "var(--status-running)" }}
          />{" "}
          RUNNING · pid 48211
        </span>
        <button className="btn">Restart</button>
      </div>
      <div className="setting-row">
        <div>
          <div className="setting-label">Host bind</div>
          <div className="setting-help">
            Dashboard never exposes beyond loopback.
          </div>
        </div>
        <input className="setting-input" value="127.0.0.1:3000" readOnly />
      </div>
      <div className="setting-row">
        <div>
          <div className="setting-label">Claude model</div>
          <div className="setting-help">Default model for headless runs.</div>
        </div>
        <input className="setting-input" defaultValue="claude-sonnet-4-5" />
      </div>

      <SectionHead title="Cost guardrails" meta="LEDGER" />
      <div className="setting-row">
        <div>
          <div className="setting-label">Monthly cap</div>
          <div className="setting-help">
            Hard stop when reached. Soft warning at 80%.
          </div>
        </div>
        <input className="setting-input" defaultValue="$20.00" />
      </div>
      <div className="setting-row">
        <div>
          <div className="setting-label">Per-run cap</div>
          <div className="setting-help">
            Aborts any single run that exceeds.
          </div>
        </div>
        <input className="setting-input" defaultValue="$2.00" />
      </div>
      <div className="setting-row">
        <div>
          <div className="setting-label">Allow Urgent override</div>
          <div className="setting-help">
            Urgent-priority issues bypass per-run cap.
          </div>
        </div>
        <Toggle on />
      </div>

      <SectionHead title="MCP servers" meta="INTEGRATIONS" />
      <McpRow
        name="github"
        url="stdio · @modelcontextprotocol/server-github"
        status="connected"
      />
      <McpRow
        name="linear"
        url="stdio · @linear/mcp-server"
        status="connected"
      />
      <McpRow
        name="obsidian"
        url="stdio · obsidian-mcp · vault/"
        status="connected"
      />
      <McpRow
        name="substack"
        url="http  · https://api.substack.com/mcp"
        status="error"
      />

      <SectionHead title="Vault layout" meta="MEMORY" />
      <div className="setting-row">
        <div>
          <div className="setting-label">Vault path</div>
          <div className="setting-help">
            Obsidian-compatible filesystem.
          </div>
        </div>
        <input className="setting-input" defaultValue="~/Agentic-OS/vault" />
      </div>
      <div className="setting-row">
        <div>
          <div className="setting-label">Raw → Wiki promotion</div>
          <div className="setting-help">
            Run nightly. Drafts go to review.
          </div>
        </div>
        <Toggle on />
      </div>

      <SectionHead title="Appearance" meta="LOOK & FEEL" />
      <div className="setting-row">
        <div>
          <div className="setting-label">Density</div>
          <div className="setting-help">
            Card / row spacing for board and lists.
          </div>
        </div>
        <DensityPicker
          value={tweaks.density}
          onChange={(v) => setTweak("density", v)}
        />
      </div>
      <div className="setting-row">
        <div>
          <div className="setting-label">Starfield</div>
          <div className="setting-help">Cosmic backdrop intensity.</div>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={tweaks.starfield}
          onChange={(e) => setTweak("starfield", parseFloat(e.target.value))}
          style={{ width: 220 }}
        />
        <span className="font-mono muted" style={{ fontSize: 11 }}>
          {Math.round(tweaks.starfield * 100)}%
        </span>
      </div>
      <div className="setting-row">
        <div>
          <div className="setting-label">Live pulse rings</div>
          <div className="setting-help">
            Animated rings on running agent avatars.
          </div>
        </div>
        <Toggle
          on={tweaks.pulse}
          onChange={() => setTweak("pulse", !tweaks.pulse)}
        />
      </div>
    </div>
  );
}

function McpRow({
  name,
  url,
  status,
}: {
  name: string;
  url: string;
  status: "connected" | "error";
}) {
  const tone = status === "connected" ? "good" : "bad";
  return (
    <div className="setting-row">
      <div>
        <div className="setting-label font-mono">{name}</div>
        <div className="setting-help font-mono">{url}</div>
      </div>
      <span className={"pill pill-" + tone}>
        <span
          className="dot"
          style={{
            background:
              status === "connected" ? "var(--teal)" : "var(--urgent)",
          }}
        />
        {status.toUpperCase()}
      </span>
      <button className="btn">Test</button>
    </div>
  );
}

function Toggle({ on, onChange }: { on?: boolean; onChange?: () => void }) {
  return <div className={"toggle " + (on ? "on" : "")} onClick={onChange} />;
}

function DensityPicker({
  value,
  onChange,
}: {
  value: Tweaks["density"];
  onChange: (v: Tweaks["density"]) => void;
}) {
  const opts: Tweaks["density"][] = ["compact", "comfy", "spacious"];
  return (
    <div className="tab-group">
      {opts.map((o) => (
        <button
          key={o}
          className={"tab " + (value === o ? "active" : "")}
          onClick={() => onChange(o)}
          style={{ textTransform: "capitalize" }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
