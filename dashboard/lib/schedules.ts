import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { CronExpressionParser } from "cron-parser";
import { automationsRemotePath } from "./paths";

export type ScheduleSpec = {
  file: string;
  skill: string;
  cron: string;
  inputs: string[];
  nextRunAt: number | null;
  relativeText: string;
  absoluteText: string;
  cronError: string | null;
};

export function loadSchedules(now: Date = new Date()): ScheduleSpec[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(automationsRemotePath, { withFileTypes: true });
  } catch {
    return [];
  }
  const nowMs = now.getTime();
  const out: ScheduleSpec[] = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".md") || e.name === "README.md") {
      continue;
    }
    const raw = fs.readFileSync(path.join(automationsRemotePath, e.name), "utf8");
    const fm = matter(raw).data as {
      schedule?: string;
      skill?: string;
      inputs?: string[];
    };
    if (!fm.schedule || !fm.skill) continue;
    let nextRunAt: number | null = null;
    let cronError: string | null = null;
    try {
      const it = CronExpressionParser.parse(fm.schedule, { currentDate: now });
      nextRunAt = it.next().getTime();
    } catch (err) {
      cronError = err instanceof Error ? err.message : String(err);
    }
    out.push({
      file: e.name,
      skill: fm.skill,
      cron: fm.schedule,
      inputs: Array.isArray(fm.inputs) ? fm.inputs : [],
      nextRunAt,
      relativeText: cronError
        ? "cron error"
        : nextRunAt !== null
          ? formatRelative(nextRunAt, nowMs)
          : "—",
      absoluteText: nextRunAt !== null ? formatAbsolute(nextRunAt) : "",
      cronError,
    });
  }
  out.sort((a, b) => {
    if (a.nextRunAt === null && b.nextRunAt === null) return 0;
    if (a.nextRunAt === null) return 1;
    if (b.nextRunAt === null) return -1;
    return a.nextRunAt - b.nextRunAt;
  });
  return out;
}

export function formatRelative(ts: number, now: number): string {
  const delta = ts - now;
  if (delta < 0) return "overdue";
  const m = Math.round(delta / 60_000);
  if (m < 60) return `in ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) {
    const rm = m % 60;
    return rm === 0 ? `in ${h}h` : `in ${h}h ${rm}m`;
  }
  const d = Math.round(h / 24);
  return d === 1 ? "tomorrow" : `in ${d}d`;
}

export function formatAbsolute(ts: number): string {
  const d = new Date(ts);
  const day = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${day} ${time}`;
}
