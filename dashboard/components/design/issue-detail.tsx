"use client";

// Ported from .design-handoff/project/issue-detail.jsx.
// Slide-over with title, body, activity timeline, run console, sidebar meta.

import { useEffect } from "react";
import {
  Avatar,
  DeptTag,
  PriorityChip,
  SectionHead,
  SkillChip,
  StatusDot,
} from "@/components/design/atoms";
import { I } from "@/components/design/icons";
import {
  ACTIVITY,
  defaultActivity,
  ISSUES,
  skillByName,
  type Issue,
} from "@/lib/design/data";

export function IssueDetail({
  issueId,
  onClose,
}: {
  issueId: string;
  onClose: () => void;
}) {
  const issue = ISSUES.find((i) => i.id === issueId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!issue) return null;
  const activity = ACTIVITY[issueId] || defaultActivity(issue);
  const skill = issue.skill ? skillByName(issue.skill) : null;
  const isRunning = issue.status === "running";

  return (
    <>
      <div className="overlay-backdrop" onClick={onClose} />
      <aside
        className="slide-over"
        role="dialog"
        aria-label={`Issue ${issue.id}`}
      >
        <header className="slide-head">
          <span className="issue-id" style={{ fontSize: 12 }}>
            {issue.id}
          </span>
          <StatusDot status={issue.status} size={11} />
          <span
            style={{
              fontSize: 11.5,
              color: "var(--text-muted)",
              textTransform: "capitalize",
            }}
          >
            {issue.status}
          </span>
          <span className="grow" />
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">
            <I.close size={14} />
          </button>
        </header>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div className="slide-body">
            <h1
              className="t-serif"
              style={{ fontSize: 22, margin: 0, color: "var(--text-white)" }}
            >
              {issue.title}
            </h1>
            <p
              style={{
                color: "var(--text-muted)",
                marginTop: 8,
                lineHeight: 1.65,
                fontSize: 13,
              }}
            >
              {issue.desc}
            </p>

            {issue.error && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  background: "rgba(192,57,43,0.08)",
                  border: "1px solid rgba(192,57,43,0.3)",
                  borderRadius: 6,
                  color: "var(--urgent)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                }}
              >
                <strong
                  style={{
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    fontSize: 10,
                  }}
                >
                  ERROR ·
                </strong>{" "}
                {issue.error}
              </div>
            )}

            {isRunning && issue.live && <RunConsole issue={issue} />}

            <div className="row" style={{ gap: 6, marginTop: 16 }}>
              <button className="btn btn-primary">
                <I.play size={12} />{" "}
                {isRunning
                  ? "Watch run"
                  : "Run with " + (issue.assignee || "agent")}
              </button>
              <button className="btn">
                <I.handoff size={12} /> Reassign
              </button>
              <button className="btn btn-ghost">
                <I.edit size={12} /> Edit
              </button>
            </div>

            <SectionHead title="Activity" meta={`${activity.length} events`} />
            <div className="timeline">
              {activity.map((a, idx) => (
                <div key={idx} className="timeline-row" data-kind={a.kind}>
                  <div className="timeline-row-head">
                    <Avatar handle={a.who} size={16} />
                    <span style={{ fontSize: 11.5, color: "var(--text-soft)" }}>
                      <strong>@{a.who}</strong> {a.text}
                    </span>
                    <span className="timeline-row-when">{a.when}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <textarea
                placeholder="Leave a comment · Cmd+Enter to send"
                rows={3}
                style={{
                  width: "100%",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-soft)",
                  fontFamily: "var(--font-body)",
                  fontSize: 12.5,
                  padding: "10px 12px",
                  resize: "vertical",
                  outline: "none",
                }}
              />
              <div className="row" style={{ marginTop: 6 }}>
                <span className="dim" style={{ fontSize: 10.5 }}>
                  Markdown supported · @mention an agent to hand off
                </span>
                <span className="grow" />
                <button className="btn btn-primary">Comment</button>
              </div>
            </div>
          </div>

          <aside className="slide-side">
            <div className="meta-block">
              <div className="meta-label">Status</div>
              <div className="row" style={{ gap: 6 }}>
                <StatusDot status={issue.status} size={11} />
                <span style={{ textTransform: "capitalize", fontSize: 12.5 }}>
                  {issue.status}
                </span>
              </div>
            </div>

            <div className="meta-block">
              <div className="meta-label">Priority</div>
              <PriorityChip priority={issue.priority} />
            </div>

            <div className="meta-block">
              <div className="meta-label">Assignee</div>
              <div className="meta-row">
                <Avatar handle={issue.assignee} size={20} running={isRunning} />
                <span className="soft">@{issue.assignee || "unassigned"}</span>
              </div>
            </div>

            <div className="meta-block">
              <div className="meta-label">Reporter</div>
              <div className="meta-row">
                <Avatar handle={issue.reporter} size={20} />
                <span className="soft">@{issue.reporter}</span>
              </div>
            </div>

            <div className="meta-block">
              <div className="meta-label">Department</div>
              <DeptTag dept={issue.dept} />
            </div>

            {skill && (
              <div className="meta-block">
                <div className="meta-label">Skill</div>
                <SkillChip name={skill.name} />
                <div className="dim" style={{ fontSize: 10.5, marginTop: 4 }}>
                  {skill.runs} runs · last {skill.lastRun}
                </div>
              </div>
            )}

            <div className="meta-block">
              <div className="meta-label">Labels</div>
              <div className="chip-row">
                {issue.labels.map((l) => (
                  <span key={l} className="pill pill-mono">
                    {l}
                  </span>
                ))}
              </div>
            </div>

            <div className="meta-block">
              <div className="meta-label">Cost</div>
              <div
                className="soft"
                style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
              >
                ${issue.cost.toFixed(2)}
              </div>
              <div
                className="dim"
                style={{
                  fontSize: 10.5,
                  marginTop: 2,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {issue.tokensIn.toLocaleString()} in ·{" "}
                {issue.tokensOut.toLocaleString()} out
              </div>
            </div>

            <div className="meta-block">
              <div className="meta-label">Timestamps</div>
              <div
                className="dim"
                style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
              >
                Filed · {issue.created}
                <br />
                Updated · {issue.updated}
              </div>
            </div>
          </aside>
        </div>
      </aside>
    </>
  );
}

function RunConsole({ issue }: { issue: Issue }) {
  if (!issue.live) return null;
  const skillFamily = issue.skill ? issue.skill.split("-")[0] : "_";
  const lines = [
    `[${issue.live.started}] ▸ Run started · agent=@${issue.assignee} skill=${issue.skill || "(freeform)"}`,
    `[${issue.live.started}] ▸ Loaded skill from skills/${skillFamily} ...`,
    `[${issue.live.started}] ▸ ${issue.live.tool} · in progress`,
    `[live] ⟳ ${issue.live.tokensPerSec} tok/s · cumulative ${issue.tokensOut.toLocaleString()} out · $${issue.cost.toFixed(2)}`,
  ];
  return (
    <div
      style={{
        marginTop: 14,
        borderRadius: 6,
        border: "1px solid rgba(74,168,150,0.3)",
        background: "rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "6px 10px",
          background: "rgba(74,168,150,0.06)",
          borderBottom: "1px solid rgba(74,168,150,0.2)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          className="dot pulse-ring"
          style={{ background: "var(--status-running)" }}
        />
        <span
          className="t-eyebrow"
          style={{ color: "var(--status-running)" }}
        >
          LIVE RUN
        </span>
        <span className="grow" />
        <span className="cost">${issue.cost.toFixed(2)}</span>
      </div>
      <pre
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          color: "var(--text-soft)",
          padding: "10px 12px",
          margin: 0,
          whiteSpace: "pre-wrap",
          lineHeight: 1.55,
          maxHeight: 160,
          overflow: "auto",
        }}
      >
        {lines.join("\n")}
        <span className="blink" style={{ color: "var(--ember)" }}>
          ▌
        </span>
      </pre>
    </div>
  );
}
