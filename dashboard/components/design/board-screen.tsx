"use client";

// Ported from .design-handoff/project/board.jsx.
// Kanban board: 5 columns (Backlog · Queued · Running · Review · Done)
// + collapsible Failed strip, live agent strip on top.

import { useEffect, useState } from "react";
import {
  Avatar,
  CostMeter,
  DeptDot,
  DeptTag,
  PriorityChip,
  SkillChip,
  Sparkline,
  StatusDot,
  Tip,
} from "@/components/design/atoms";
import { I } from "@/components/design/icons";
import {
  COLUMNS,
  PRIORITIES,
  type ColumnDef,
  type DashboardData,
  type Issue,
  type IssueStatus,
  type Priority,
  type RunningAgent,
} from "@/lib/design/types";
import type { Tweaks } from "@/components/design/tweaks-panel";

type Props = {
  onOpenIssue: (id: string) => void;
  tweaks: Tweaks;
};

type FilterValue = "all" | Priority;

const POLL_INTERVAL_MS = 30_000;

export function BoardScreen({ onOpenIssue, tweaks }: Props) {
  const [filterPriority, setFilterPriority] = useState<FilterValue>("all");
  const [view, setView] = useState<"board" | "list">("board");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [runningAgents, setRunningAgents] = useState<RunningAgent[]>([]);
  const showLiveStrip = tweaks.showLiveStrip;

  const reloadIssues = async (signal?: AbortSignal): Promise<Issue[] | null> => {
    try {
      const res = await fetch("/api/issues", { cache: "no-store", signal });
      if (!res.ok) return null;
      return (await res.json()) as Issue[];
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const next = await reloadIssues();
      if (!cancelled && next) {
        setIssues(next);
        setLoaded(true);
      }
    };
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Live strip reuses the dashboard endpoint so we don't spin up a parallel
  // running-agents route; we only poll when the strip is actually visible.
  useEffect(() => {
    if (!showLiveStrip) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/dashboard/data", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as DashboardData;
        if (!cancelled) setRunningAgents(j.runningAgents);
      } catch {}
    };
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [showLiveStrip]);

  const matchesFilter = (i: Issue) =>
    filterPriority === "all" || i.priority === filterPriority;

  const cols = COLUMNS.map((c) => ({
    ...c,
    issues: issues
      .filter((i) =>
        c.key === "queued"
          ? i.status === "queued" || i.status === "claimed"
          : i.status === c.key,
      )
      .filter(matchesFilter),
  }));
  const failed = issues.filter((i) => i.status === "failed").filter(matchesFilter);
  const total = issues.length;

  const onStatusChange = async (
    issueId: string,
    next: IssueStatus,
  ): Promise<{ ok: true } | { ok: false; message: string }> => {
    const n = Number(issueId);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, message: "bad id" };
    }
    try {
      const res = await fetch(`/api/tasks/${n}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        let msg = `status ${res.status}`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) msg = body.error;
        } catch {}
        return { ok: false, message: msg };
      }
      const fresh = await reloadIssues();
      if (fresh) setIssues(fresh);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  };

  return (
    <div className="screen">
      {/* Toolbar */}
      <div className="board-toolbar">
        <div className="tab-group">
          <button
            className={"tab " + (view === "board" ? "active" : "")}
            onClick={() => setView("board")}
          >
            <I.board size={13} /> Board
          </button>
          <button
            className={"tab " + (view === "list" ? "active" : "")}
            onClick={() => setView("list")}
          >
            <I.list size={13} /> List
          </button>
        </div>

        <div className="btn">
          <I.filter size={13} /> Filter
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as FilterValue)}
            style={{
              background: "transparent",
              color: "var(--text-soft)",
              border: 0,
              marginLeft: 4,
            }}
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="btn">
          <I.display size={13} /> Display
        </div>

        <div className="toolbar-spacer" />

        <div className="toolbar-meta">{total} ISSUES · 5 COLUMNS</div>
        <button className="btn btn-primary">
          <I.plus size={13} /> New issue
        </button>
      </div>

      {showLiveStrip && runningAgents.length > 0 ? (
        <LiveStrip running={runningAgents} onOpen={onOpenIssue} />
      ) : null}

      <div
        className="screen-body"
        style={{ display: "flex", flexDirection: "column" }}
      >
        {view === "board" ? (
          <>
            <div className="board-cols">
              {cols.map((c) => (
                <Column
                  key={c.key}
                  col={c}
                  onOpen={onOpenIssue}
                  tweaks={tweaks}
                  loaded={loaded}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
            {failed.length > 0 && (
              <FailedStrip
                failed={failed}
                onOpen={onOpenIssue}
                tweaks={tweaks}
                onStatusChange={onStatusChange}
              />
            )}
          </>
        ) : (
          <BoardListView
            issues={issues.filter(matchesFilter)}
            onOpen={onOpenIssue}
          />
        )}
      </div>
    </div>
  );
}

function LiveStrip({
  running,
  onOpen,
}: {
  running: RunningAgent[];
  onOpen: (id: string) => void;
}) {
  const totalCost = running.reduce((s, a) => s + a.costSoFar, 0);
  const totalTokens = running.reduce(
    (s, a) => s + a.tokensIn + a.tokensOut,
    0,
  );
  return (
    <div className="live-strip">
      <span className="live-strip-label">
        <span
          className="dot pulse-ring"
          style={{ background: "var(--status-running)" }}
        />
        Live · {running.length} agent{running.length === 1 ? "" : "s"}
      </span>
      {running.map((a) => (
        <button
          key={a.taskId}
          className="live-strip-card"
          onClick={() => onOpen(String(a.taskId))}
        >
          <Avatar handle={a.agent} size={20} running />
          <span className="live-strip-id">#{a.taskId}</span>
          <span className="live-strip-title truncate">{a.title}</span>
          <span className="live-strip-tps">
            {Math.round((a.tokensIn + a.tokensOut) / 1000)}k tok
          </span>
          <span className="live-strip-cost">${a.costSoFar.toFixed(2)}</span>
        </button>
      ))}
      <span className="toolbar-spacer" />
      <span className="toolbar-meta">
        {Math.round(totalTokens / 1000)}K TOK · ${totalCost.toFixed(2)} BURN
      </span>
    </div>
  );
}

type StatusChange = (
  issueId: string,
  next: IssueStatus,
) => Promise<{ ok: true } | { ok: false; message: string }>;

const STATUS_OPTIONS: IssueStatus[] = [
  "backlog",
  "queued",
  "claimed",
  "running",
  "review",
  "done",
  "failed",
];

function Column({
  col,
  onOpen,
  tweaks,
  loaded,
  onStatusChange,
}: {
  col: ColumnDef & { issues: Issue[] };
  onOpen: (id: string) => void;
  tweaks: Tweaks;
  loaded: boolean;
  onStatusChange: StatusChange;
}) {
  const cost = col.issues.reduce((s, i) => s + (i.cost || 0), 0);
  const spark =
    col.issues.length > 0
      ? col.issues
          .slice(0, 7)
          .map((i) => Math.max(1, (i.tokensOut || 0) / 1000))
          .reverse()
      : null;

  return (
    <section className="col-card">
      <header className="col-head">
        <div className="col-head-row">
          <StatusDot status={col.key} size={12} />
          <span className="col-head-label">{col.label}</span>
          <span className="col-head-count">{col.issues.length}</span>
          <div className="col-head-actions">
            <button className="btn btn-icon" title="Column menu">
              <I.more size={14} />
            </button>
            <button className="btn btn-icon" title="Add issue to this column">
              <I.plus size={14} />
            </button>
          </div>
        </div>
        <div className="col-head-meta">
          <span className="col-cost">${cost.toFixed(2)} spent</span>
          {spark && (
            <span style={{ marginLeft: "auto" }}>
              <Sparkline values={spark} width={48} height={10} color={col.color} />
            </span>
          )}
        </div>
      </header>

      <div className="col-body">
        {!loaded ? (
          <div className="col-body-empty">Loading issues…</div>
        ) : col.issues.length === 0 ? (
          <div className="col-body-empty">No issues here.</div>
        ) : (
          col.issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onOpen={onOpen}
              tweaks={tweaks}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function IssueCard({
  issue,
  onOpen,
  tweaks,
  onStatusChange,
}: {
  issue: Issue;
  onOpen: (id: string) => void;
  tweaks: Tweaks;
  onStatusChange?: StatusChange;
}) {
  const isRunning = issue.status === "running";
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const [error, setError] = useState<string | null>(null);

  // Error chip auto-clears after 3s so a stale message doesn't sit on the card.
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(id);
  }, [error]);

  const handleStatusSelect = async (next: IssueStatus) => {
    if (!onStatusChange || next === issue.status) return;
    const result = await onStatusChange(issue.id, next);
    if (!result.ok) setError(result.message);
  };

  return (
    <article
      className={"issue-card " + (isRunning ? "is-running" : "")}
      onClick={() => onOpen(issue.id)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(issue.id);
      }}
    >
      <div className="issue-actions">
        <Tip
          content={`Hand off to ${issue.assignee ? "@" + issue.assignee : "an agent"}`}
          side="top"
        >
          <button
            className="btn btn-icon"
            onClick={stop}
            aria-label="Hand off"
          >
            <I.handoff size={13} />
          </button>
        </Tip>
        <Tip content={isRunning ? "Pause run" : "Run now"} side="top">
          <button className="btn btn-icon" onClick={stop} aria-label="Run">
            {isRunning ? <I.pause size={12} /> : <I.play size={12} />}
          </button>
        </Tip>
      </div>

      <div className="row" style={{ gap: 6 }}>
        <span className="issue-id">{issue.id}</span>
        <span className="grow" />
        {tweaks.showDeptDot && <DeptDot dept={issue.dept} />}
      </div>

      <div className="issue-title">{issue.title}</div>

      <div className="issue-meta-row">
        <PriorityChip priority={issue.priority} />
        {tweaks.showSkill && issue.skill && <SkillChip name={issue.skill} />}
        <span className="grow" />
        {tweaks.showCost && issue.cost > 0 && (
          <CostMeter cost={issue.cost} compact />
        )}
        {onStatusChange && (
          <select
            value={issue.status}
            onClick={stop}
            onChange={(e) => {
              e.stopPropagation();
              void handleStatusSelect(e.target.value as IssueStatus);
            }}
            aria-label="Move issue"
            style={{
              background: "transparent",
              color: "var(--text-soft)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              fontSize: 10.5,
              padding: "1px 4px",
            }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <Avatar
          handle={issue.assignee}
          size={20}
          ring={isRunning}
          running={isRunning}
        />
      </div>

      {error && (
        <div
          className="pill"
          onClick={stop}
          style={{
            marginTop: 4,
            color: "var(--urgent)",
            borderColor: "var(--urgent)",
            fontSize: 10.5,
          }}
          title={error}
        >
          {error.slice(0, 60)}
        </div>
      )}

      {isRunning && issue.live && (
        <div className="issue-live">
          <span className="issue-live-dot" />
          <span className="issue-live-tool">{issue.live.tool}</span>
          <span className="issue-live-tps">
            {issue.live.tokensPerSec} tok/s · {issue.live.started}
          </span>
        </div>
      )}
    </article>
  );
}

function FailedStrip({
  failed,
  onOpen,
  tweaks,
  onStatusChange,
}: {
  failed: Issue[];
  onOpen: (id: string) => void;
  tweaks: Tweaks;
  onStatusChange: StatusChange;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="failed-strip">
      <div className="failed-strip-head" onClick={() => setOpen(!open)}>
        <I.warning size={14} />
        FAILED · {failed.length}
        <span className="toolbar-spacer" />
        <I.chevron
          size={14}
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
        />
      </div>
      {open && (
        <div className="failed-strip-list">
          {failed.map((i) => (
            <IssueCard
              key={i.id}
              issue={i}
              onOpen={onOpen}
              tweaks={tweaks}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardListView({
  issues,
  onOpen,
}: {
  issues: Issue[];
  onOpen: (id: string) => void;
}) {
  const sorted = [...issues].sort((a, b) => {
    const ra = a.priority ? PRIORITIES[a.priority].rank : 0;
    const rb = b.priority ? PRIORITIES[b.priority].rank : 0;
    if (rb !== ra) return rb - ra;
    return a.id.localeCompare(b.id);
  });
  return (
    <div style={{ padding: "8px 16px 16px", overflowY: "auto", height: "100%" }}>
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 70 }}>ID</th>
            <th style={{ width: 80 }}>Priority</th>
            <th>Title</th>
            <th style={{ width: 100 }}>Dept</th>
            <th style={{ width: 130 }}>Skill</th>
            <th style={{ width: 90 }}>Status</th>
            <th style={{ width: 80 }}>Cost</th>
            <th style={{ width: 40 }}>Owner</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((i) => (
            <tr
              key={i.id}
              onClick={() => onOpen(i.id)}
              style={{ cursor: "pointer" }}
            >
              <td className="font-mono dim">{i.id}</td>
              <td>
                <PriorityChip priority={i.priority} />
              </td>
              <td className="soft">{i.title}</td>
              <td>
                <DeptTag dept={i.dept} />
              </td>
              <td>
                {i.skill ? (
                  <SkillChip name={i.skill} />
                ) : (
                  <span className="dim">—</span>
                )}
              </td>
              <td>
                <span className="row" style={{ gap: 4 }}>
                  <StatusDot status={i.status} size={10} />
                  <span className="muted" style={{ fontSize: 11 }}>
                    {i.status}
                  </span>
                </span>
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
  );
}
