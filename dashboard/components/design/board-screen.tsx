"use client";

// Ported from .design-handoff/project/board.jsx.
// Kanban board: 5 columns (Backlog · Queued · Running · Review · Done)
// + collapsible Failed strip, live agent strip on top.

import { useState } from "react";
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
  failedIssues,
  ISSUES,
  issuesInCol,
  PRIORITIES,
  type Issue,
  type Priority,
} from "@/lib/design/data";
import type { Tweaks } from "@/components/design/tweaks-panel";

type Props = {
  onOpenIssue: (id: string) => void;
  tweaks: Tweaks;
};

type FilterValue = "all" | Priority;

export function BoardScreen({ onOpenIssue, tweaks }: Props) {
  const [filterPriority, setFilterPriority] = useState<FilterValue>("all");
  const [view, setView] = useState<"board" | "list">("board");
  const showLiveStrip = tweaks.showLiveStrip;

  const matchesFilter = (i: Issue) =>
    filterPriority === "all" || i.priority === filterPriority;

  const cols = COLUMNS.map((c) => ({
    ...c,
    issues: issuesInCol(c.key).filter(matchesFilter),
  }));
  const failed = failedIssues().filter(matchesFilter);
  const total = ISSUES.length;
  const runningIssues = ISSUES.filter((i) => i.status === "running");

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

      {showLiveStrip && runningIssues.length > 0 && (
        <LiveStrip running={runningIssues} onOpen={onOpenIssue} />
      )}

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
                />
              ))}
            </div>
            {failed.length > 0 && (
              <FailedStrip failed={failed} onOpen={onOpenIssue} tweaks={tweaks} />
            )}
          </>
        ) : (
          <BoardListView
            issues={ISSUES.filter(matchesFilter)}
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
  running: Issue[];
  onOpen: (id: string) => void;
}) {
  const totalCost = running.reduce((s, i) => s + (i.cost || 0), 0);
  const totalTps = running.reduce(
    (s, i) => s + (i.live?.tokensPerSec || 0),
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
      {running.map((i) => (
        <button
          key={i.id}
          className="live-strip-card"
          onClick={() => onOpen(i.id)}
        >
          <Avatar handle={i.assignee} size={20} running />
          <span className="live-strip-id">{i.id}</span>
          <span className="live-strip-title truncate">{i.title}</span>
          <span className="live-strip-tps">{i.live?.tokensPerSec ?? 0} tok/s</span>
          <span className="live-strip-cost">${i.cost.toFixed(2)}</span>
        </button>
      ))}
      <span className="toolbar-spacer" />
      <span className="toolbar-meta">
        {totalTps} TOK/S · ${totalCost.toFixed(2)} BURN
      </span>
    </div>
  );
}

function Column({
  col,
  onOpen,
  tweaks,
}: {
  col: { key: string; label: string; color: string; issues: Issue[] };
  onOpen: (id: string) => void;
  tweaks: Tweaks;
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
        {col.issues.length === 0 ? (
          <div className="col-body-empty">No issues here.</div>
        ) : (
          col.issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onOpen={onOpen}
              tweaks={tweaks}
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
}: {
  issue: Issue;
  onOpen: (id: string) => void;
  tweaks: Tweaks;
}) {
  const isRunning = issue.status === "running";
  const stop = (e: React.MouseEvent) => e.stopPropagation();

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
        <Avatar
          handle={issue.assignee}
          size={20}
          ring={isRunning}
          running={isRunning}
        />
      </div>

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
}: {
  failed: Issue[];
  onOpen: (id: string) => void;
  tweaks: Tweaks;
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
            <IssueCard key={i.id} issue={i} onOpen={onOpen} tweaks={tweaks} />
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
