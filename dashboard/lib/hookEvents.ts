import { getDb } from "@/lib/db";

export interface HookEventPayload {
  /** True when the dashboard derived this event from PTY lifecycle rather than
   * the CLI emitting it through a real hook. */
  synthetic: boolean;
  runtimeId?: string;
  detail?: string;
}

export interface HookEventRow {
  id: number;
  runId: number | null;
  sessionId: string | null;
  eventType: string;
  payload: HookEventPayload;
  receivedAt: number;
  runtimeId: string | null;
  issueId: number | null;
  issueTitle: string | null;
  projectSlug: string | null;
}

/** Persist a lifecycle/hook event. Real hook posts (e.g. Claude SessionStart)
 * pass synthetic:false; events the dashboard synthesizes from spawn/exit pass
 * synthetic:true so the UI can label them honestly. */
export function recordHookEvent(opts: {
  runId: number | null;
  sessionId?: string | null;
  eventType: string;
  payload: HookEventPayload;
}): void {
  getDb()
    .prepare(
      `INSERT INTO hook_events (run_id, session_id, event_type, payload, received_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      opts.runId,
      opts.sessionId ?? null,
      opts.eventType,
      JSON.stringify(opts.payload),
      Date.now()
    );
}

function rowToHookEvent(row: any): HookEventRow {
  let payload: HookEventPayload = { synthetic: false };
  try {
    payload = JSON.parse(row.payload);
  } catch {
    // tolerate legacy/non-JSON payloads
    payload = { synthetic: false, detail: String(row.payload) };
  }
  return {
    id: row.id,
    runId: row.run_id,
    sessionId: row.session_id,
    eventType: row.event_type,
    payload,
    receivedAt: row.received_at,
    runtimeId: row.runtime_id ?? payload.runtimeId ?? null,
    issueId: row.issue_id ?? null,
    issueTitle: row.issue_title ?? null,
    projectSlug: row.project_slug ?? null,
  };
}

/** Recent events, joined to their run/issue for display context. */
export function listHookEvents(opts: { limit?: number } = {}): HookEventRow[] {
  const limit = opts.limit ?? 100;
  return getDb()
    .prepare(
      `SELECT h.*, r.runtime_id, r.issue_id, i.title AS issue_title, i.project_slug
       FROM hook_events h
       LEFT JOIN runs r ON r.id = h.run_id
       LEFT JOIN issues i ON i.id = r.issue_id
       ORDER BY h.received_at DESC, h.id DESC
       LIMIT ?`
    )
    .all(limit)
    .map(rowToHookEvent);
}
