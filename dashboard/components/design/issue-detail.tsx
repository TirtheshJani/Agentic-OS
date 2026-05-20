"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  DeptTag,
  PriorityChip,
  SectionHead,
  StatusDot,
} from "@/components/design/atoms";
import { I } from "@/components/design/icons";
import { IssueLaunchButtons } from "@/components/issue-launch-buttons";
import type {
  IssueDetail as IssueDetailData,
  IssueStatus,
  RecentRun,
} from "@/lib/design/types";

const STATUS_OPTIONS: IssueStatus[] = [
  "backlog",
  "queued",
  "claimed",
  "running",
  "review",
  "done",
  "failed",
];

type ThreadEntry = { ts: string; author: string; body: string };

type TimelineItem =
  | { kind: "run"; ts: string; run: RecentRun }
  | { kind: "thread"; ts: string; entry: ThreadEntry };

// Each thread line is `[ISO] author: body` per the threads route contract.
// Anything that doesn't match drops on the floor rather than rendering garbage.
function parseThread(content: string): ThreadEntry[] {
  const out: ThreadEntry[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();
    if (!line) continue;
    const m = line.match(/^\[([^\]]+)\]\s+([^:]+):\s?(.*)$/);
    if (!m) continue;
    out.push({ ts: m[1], author: m[2].trim(), body: m[3] });
  }
  return out;
}

export function IssueDetail({
  issueId,
  onClose,
}: {
  issueId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<IssueDetailData | null>(null);
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [comment, setComment] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fetchDetail = useCallback(
    async (signal?: AbortSignal): Promise<IssueDetailData | null> => {
      const res = await fetch(
        `/api/tasks/${encodeURIComponent(issueId)}/detail`,
        { cache: "no-store", signal }
      );
      if (!res.ok) return null;
      return (await res.json()) as IssueDetailData;
    },
    [issueId]
  );

  const fetchThread = useCallback(
    async (signal?: AbortSignal): Promise<ThreadEntry[]> => {
      const res = await fetch(
        `/api/threads/${encodeURIComponent(issueId)}`,
        { cache: "no-store", signal }
      );
      if (!res.ok) return [];
      const j = (await res.json()) as { content?: string };
      return parseThread(j.content ?? "");
    },
    [issueId]
  );

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      const [d, t] = await Promise.all([
        fetchDetail(ac.signal),
        fetchThread(ac.signal),
      ]);
      if (cancelled) return;
      setDetail(d);
      setThread(t);
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [fetchDetail, fetchThread]);

  // Auto-clear inline errors so a stale message doesn't sit forever.
  useEffect(() => {
    if (!statusError) return;
    const id = setTimeout(() => setStatusError(null), 3000);
    return () => clearTimeout(id);
  }, [statusError]);
  useEffect(() => {
    if (!commentError) return;
    const id = setTimeout(() => setCommentError(null), 3000);
    return () => clearTimeout(id);
  }, [commentError]);

  const timeline: TimelineItem[] = useMemo(() => {
    if (!detail) return [];
    const items: TimelineItem[] = [];
    for (const r of detail.recentRuns) items.push({ kind: "run", ts: r.started, run: r });
    for (const e of thread) items.push({ kind: "thread", ts: e.ts, entry: e });
    return items.sort((a, b) => b.ts.localeCompare(a.ts));
  }, [detail, thread]);

  if (!detail) {
    return (
      <>
        <div className="overlay-backdrop" onClick={onClose} />
        <aside
          className="slide-over"
          role="dialog"
          aria-label={`Issue ${issueId}`}
        >
          <header className="slide-head">
            <span className="issue-id" style={{ fontSize: 12 }}>
              {issueId}
            </span>
            <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              Loading…
            </span>
            <span className="grow" />
            <button
              className="btn btn-ghost"
              onClick={onClose}
              aria-label="Close"
            >
              <I.close size={14} />
            </button>
          </header>
          <div style={{ padding: 20 }}>
            <div className="skeleton-line" style={skeletonStyle(40)} />
            <div className="skeleton-line" style={skeletonStyle(80)} />
            <div className="skeleton-line" style={skeletonStyle(60)} />
          </div>
        </aside>
      </>
    );
  }

  const { issue, labels } = detail;
  const isRunning = issue.status === "running";

  const handleStatusChange = async (next: IssueStatus) => {
    if (next === issue.status) return;
    setStatusError(null);
    try {
      const res = await fetch(
        `/api/tasks/${encodeURIComponent(issueId)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        }
      );
      if (!res.ok) {
        let msg = `status ${res.status}`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) msg = body.error;
        } catch {}
        setStatusError(msg);
        return;
      }
      const fresh = await fetchDetail();
      if (fresh) setDetail(fresh);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : String(e));
    }
  };

  const submitComment = async () => {
    const body = comment.trim();
    if (!body || commentBusy) return;
    setCommentBusy(true);
    setCommentError(null);
    try {
      const res = await fetch(
        `/api/threads/${encodeURIComponent(issueId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        }
      );
      if (!res.ok) {
        let msg = `comment ${res.status}`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {}
        setCommentError(msg);
        return;
      }
      setComment("");
      const t = await fetchThread();
      setThread(t);
    } catch (e) {
      setCommentError(e instanceof Error ? e.message : String(e));
    } finally {
      setCommentBusy(false);
    }
  };

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
                whiteSpace: "pre-wrap",
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

            <div style={{ marginTop: 16 }}>
              <IssueLaunchButtons
                taskId={Number(issue.id)}
                assignee={issue.assignee ?? "user"}
                prompt={issue.desc}
                projectSlug={detail.projectSlug}
                defaultRepo={detail.defaultRepo}
              />
            </div>

            <SectionHead
              title="Activity"
              meta={`${timeline.length} ${timeline.length === 1 ? "event" : "events"}`}
            />
            <div className="timeline">
              {timeline.length === 0 && (
                <div
                  className="dim"
                  style={{ fontSize: 11.5, padding: "8px 4px" }}
                >
                  No activity yet.
                </div>
              )}
              {timeline.map((item, idx) =>
                item.kind === "run" ? (
                  <div
                    key={`run-${item.run.id}-${idx}`}
                    className="timeline-row"
                    data-kind="run-start"
                  >
                    <div className="timeline-row-head">
                      <Avatar handle={item.run.agent} size={16} />
                      <span
                        style={{ fontSize: 11.5, color: "var(--text-soft)" }}
                      >
                        <strong>@{item.run.agent}</strong> ran {item.run.skill}{" "}
                        ({item.run.status} · {item.run.duration} · $
                        {item.run.cost.toFixed(2)})
                      </span>
                      <span className="timeline-row-when">
                        {relTime(item.ts)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    key={`thread-${idx}`}
                    className="timeline-row"
                    data-kind="comment"
                  >
                    <div className="timeline-row-head">
                      <Avatar handle={item.entry.author} size={16} />
                      <span
                        style={{ fontSize: 11.5, color: "var(--text-soft)" }}
                      >
                        <strong>@{item.entry.author}</strong> {item.entry.body}
                      </span>
                      <span className="timeline-row-when">
                        {relTime(item.ts)}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    void submitComment();
                  }
                }}
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
                  Appends to vault/threads/{issue.id}.md
                </span>
                <span className="grow" />
                {commentError && (
                  <span
                    className="pill"
                    style={{
                      color: "var(--urgent)",
                      borderColor: "var(--urgent)",
                      fontSize: 10.5,
                    }}
                    title={commentError}
                  >
                    {commentError.slice(0, 60)}
                  </span>
                )}
                <button
                  className="btn btn-primary"
                  disabled={commentBusy || !comment.trim()}
                  onClick={() => void submitComment()}
                >
                  {commentBusy ? "Sending…" : "Comment"}
                </button>
              </div>
            </div>
          </div>

          <aside className="slide-side">
            <div className="meta-block">
              <div className="meta-label">Status</div>
              <div className="row" style={{ gap: 6, alignItems: "center" }}>
                <StatusDot status={issue.status} size={11} />
                <select
                  value={issue.status}
                  onChange={(e) =>
                    void handleStatusChange(e.target.value as IssueStatus)
                  }
                  aria-label="Change status"
                  style={{
                    background: "transparent",
                    color: "var(--text-soft)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    fontSize: 12,
                    padding: "2px 6px",
                  }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {statusError && (
                <div
                  className="pill"
                  style={{
                    marginTop: 6,
                    color: "var(--urgent)",
                    borderColor: "var(--urgent)",
                    fontSize: 10.5,
                  }}
                  title={statusError}
                >
                  {statusError.slice(0, 60)}
                </div>
              )}
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

            <div className="meta-block">
              <div className="meta-label">Labels</div>
              <div className="chip-row">
                {labels.length === 0 && (
                  <span className="dim" style={{ fontSize: 11 }}>
                    None
                  </span>
                )}
                {labels.map((l) => (
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

function skeletonStyle(widthPct: number): React.CSSProperties {
  return {
    height: 12,
    width: `${widthPct}%`,
    background: "rgba(255,255,255,0.05)",
    borderRadius: 4,
    marginBottom: 10,
  };
}

function relTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}
