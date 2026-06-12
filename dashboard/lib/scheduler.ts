import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { CronExpressionParser } from "cron-parser";
import { REPO_ROOT } from "@/lib/paths";
import { getDb } from "@/lib/db";
import { createIssue } from "@/lib/issues";
import { getSettings } from "@/lib/settings";
import { appendEvent } from "@/lib/threads";
import { publish } from "@/lib/stream";

const TICK_INTERVAL_MS = 60_000;
/** A fire scheduled longer ago than this (laptop asleep) is skipped, not replayed. */
const MISSED_WINDOW_MS = 6 * 60 * 60 * 1000;

export interface AutomationSpec {
  file: string;
  skill: string;
  cron: string;
  /** Target project slug; without it the dashboard cannot file an issue. */
  project?: string;
  /** Optional pre-assigned agent; otherwise the auto-router picks one. */
  agent?: string;
  inputs: string[];
  body: string;
  cronError: string | null;
}

export function loadAutomations(
  rootDir: string = path.join(REPO_ROOT, "automations", "remote")
): AutomationSpec[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: AutomationSpec[] = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".md") || e.name === "README.md") continue;
    const parsed = matter(fs.readFileSync(path.join(rootDir, e.name), "utf8"));
    const fm = parsed.data as {
      schedule?: string;
      skill?: string;
      project?: string;
      agent?: string;
      inputs?: string[];
    };
    if (!fm.schedule || !fm.skill) continue;
    let cronError: string | null = null;
    try {
      CronExpressionParser.parse(fm.schedule);
    } catch (err) {
      cronError = err instanceof Error ? err.message : String(err);
    }
    out.push({
      file: e.name,
      skill: fm.skill,
      cron: fm.schedule,
      project: fm.project,
      agent: fm.agent,
      inputs: Array.isArray(fm.inputs) ? fm.inputs : [],
      body: parsed.content.trim(),
      cronError,
    });
  }
  return out;
}

/** Most recent scheduled fire time at or before `now`, or null on parse error. */
export function lastScheduledFire(cron: string, now: Date): number | null {
  try {
    const it = CronExpressionParser.parse(cron, { currentDate: now });
    return it.prev().getTime();
  } catch {
    return null;
  }
}

export interface DueResult {
  spec: AutomationSpec;
  scheduledAt: number;
}

/**
 * Pure due-check: a spec fires when its most recent scheduled time is newer
 * than its recorded last run AND within the missed-run window. Specs without
 * a project target or with a broken cron never fire.
 */
export function dueAutomations(
  specs: AutomationSpec[],
  opts: { now: Date; lastRunByFile: Map<string, number>; missedWindowMs?: number }
): DueResult[] {
  const windowMs = opts.missedWindowMs ?? MISSED_WINDOW_MS;
  const nowMs = opts.now.getTime();
  const due: DueResult[] = [];
  for (const spec of specs) {
    if (spec.cronError || !spec.project) continue;
    const scheduledAt = lastScheduledFire(spec.cron, opts.now);
    if (scheduledAt == null) continue;
    const last = opts.lastRunByFile.get(spec.file) ?? 0;
    if (scheduledAt > last && nowMs - scheduledAt <= windowMs) {
      due.push({ spec, scheduledAt });
    }
  }
  return due;
}

function readScheduleState(): Map<string, number> {
  const rows = getDb().prepare("SELECT file, last_run_at FROM schedule_state").all() as Array<{
    file: string;
    last_run_at: number;
  }>;
  return new Map(rows.map((r) => [r.file, r.last_run_at]));
}

function recordFire(file: string, scheduledAt: number, status: string, issueId: number | null): void {
  getDb()
    .prepare(
      `INSERT INTO schedule_state (file, last_run_at, last_status, last_issue_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(file) DO UPDATE SET
         last_run_at = excluded.last_run_at,
         last_status = excluded.last_status,
         last_issue_id = excluded.last_issue_id`
    )
    .run(file, scheduledAt, status, issueId);
}

const warnedFiles = new Set<string>();

/** One scheduler pass: file a queued issue for every due automation. */
export function tick(now: Date = new Date()): number {
  const specs = loadAutomations();
  for (const spec of specs) {
    if (!spec.project && !spec.cronError && !warnedFiles.has(spec.file)) {
      warnedFiles.add(spec.file);
      console.log(
        `[scheduler] ${spec.file} has no "project:" key; add one to let the dashboard file issues for it`
      );
    }
  }
  const due = dueAutomations(specs, { now, lastRunByFile: readScheduleState() });
  let fired = 0;
  for (const { spec, scheduledAt } of due) {
    try {
      const dateTag = now.toISOString().slice(0, 10);
      const issueId = createIssue({
        projectSlug: spec.project!,
        title: `[auto] ${spec.skill} (${dateTag})`,
        body: [
          `Scheduled run of skill "${spec.skill}" from automations/remote/${spec.file}.`,
          spec.inputs.length ? `Inputs: ${spec.inputs.join(", ")}` : "",
          "",
          spec.body,
        ].filter(Boolean).join("\n"),
        assigneeSlug: spec.agent ?? null,
        status: "queued",
        labels: ["automation"],
      });
      recordFire(spec.file, scheduledAt, "queued", issueId);
      appendEvent({
        projectSlug: spec.project!,
        issueId,
        eventType: "scheduler.fired",
        details: `Automation ${spec.file} (cron "${spec.cron}") filed this issue.`,
      });
      publish({ kind: "issue.changed", id: issueId, projectSlug: spec.project!, reason: "create" });
      publish({ kind: "thread.appended", issueId });
      fired++;
      console.log(`[scheduler] fired ${spec.file} -> issue ${issueId}`);
    } catch (err) {
      console.error(`[scheduler] failed to fire ${spec.file}:`, err);
      recordFire(spec.file, scheduledAt, `error: ${(err as Error).message}`.slice(0, 200), null);
    }
  }
  return fired;
}

interface SchedulerState {
  stop: () => void;
}

const globalKey = Symbol.for("agentic-os.scheduler");
const g = globalThis as unknown as Record<symbol, SchedulerState | undefined>;

/** 60s cron loop, gated on the autonomy kill switch AND the scheduler toggle. */
export function startScheduler(): () => void {
  if (g[globalKey]) return g[globalKey]!.stop;

  const interval = setInterval(() => {
    const s = getSettings();
    if (!s.autonomy.enabled || !s.autonomy.schedulerEnabled) return;
    try {
      tick();
    } catch (err) {
      console.error("[scheduler] tick failed:", err);
    }
  }, TICK_INTERVAL_MS);
  interval.unref?.();

  const stop = () => {
    clearInterval(interval);
    g[globalKey] = undefined;
  };
  g[globalKey] = { stop };
  console.log("[scheduler] started (fires only while autonomy + scheduler toggles are on)");
  return stop;
}
