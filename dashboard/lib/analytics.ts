import { getDb } from "./db";
import { loadSkills } from "./skills-loader";

export type SkillCount = { skill: string; count: number; status: string };
export type DomainCount = { domain: string; count: number };
export type WeekCount = { week: string; count: number };

export function runsBySkill(limit = 20): SkillCount[] {
  const rows = getDb()
    .prepare(
      `SELECT skill_slug AS skill, COUNT(*) AS count
       FROM runs
       GROUP BY skill_slug
       ORDER BY count DESC
       LIMIT ?`
    )
    .all(limit) as { skill: string; count: number }[];
  const statusBySkill = new Map(loadSkills().map((s) => [s.name, s.status]));
  return rows.map((r) => ({
    ...r,
    status: statusBySkill.get(r.skill) ?? "unknown",
  }));
}

export function runsByDomain(): DomainCount[] {
  const counts = getDb()
    .prepare(`SELECT skill_slug, COUNT(*) AS count FROM runs GROUP BY skill_slug`)
    .all() as { skill_slug: string; count: number }[];
  const domainBySkill = new Map(loadSkills().map((s) => [s.name, topDomain(s.domain)]));
  const out = new Map<string, number>();
  for (const { skill_slug, count } of counts) {
    const dom = domainBySkill.get(skill_slug) ?? "unknown";
    out.set(dom, (out.get(dom) ?? 0) + count);
  }
  return Array.from(out.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);
}

function topDomain(d: string): string {
  if (!d) return "unknown";
  return d.split("/")[0];
}

export function runsByWeek(weeks = 12): WeekCount[] {
  const rows = getDb()
    .prepare(
      `SELECT strftime('%Y-W%W', started_at / 1000, 'unixepoch') AS week,
              COUNT(*) AS count
       FROM runs
       GROUP BY week
       ORDER BY week DESC
       LIMIT ?`
    )
    .all(weeks) as WeekCount[];
  return rows.reverse();
}

export function totalRuns(): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM runs`)
    .get() as { n: number };
  return row.n;
}

export type Totals = {
  runs: number;
  done: number;
  error: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

export function totals(): Totals {
  const row = getDb()
    .prepare(
      `SELECT
         COUNT(*) AS runs,
         COALESCE(SUM(CASE WHEN status = 'done'  THEN 1 ELSE 0 END), 0) AS done,
         COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END), 0) AS error,
         COALESCE(SUM(tokens_in),  0) AS tokensIn,
         COALESCE(SUM(tokens_out), 0) AS tokensOut,
         COALESCE(SUM(cost_usd),   0) AS costUsd
       FROM runs`
    )
    .get() as Totals;
  return row;
}

export type CostRow = { skill: string; costUsd: number; runs: number };

export function costBySkill(limit = 10): CostRow[] {
  return getDb()
    .prepare(
      `SELECT skill_slug AS skill,
              COALESCE(SUM(cost_usd), 0) AS costUsd,
              COUNT(*) AS runs
       FROM runs
       WHERE cost_usd IS NOT NULL
       GROUP BY skill_slug
       HAVING costUsd > 0
       ORDER BY costUsd DESC
       LIMIT ?`
    )
    .all(limit) as CostRow[];
}

export type DurationRow = {
  skill: string;
  runs: number;
  p50Ms: number;
  p95Ms: number;
};

export function durationBySkill(limit = 10): DurationRow[] {
  // SQLite has no percentile_cont; pull per-skill durations and compute in JS.
  const skills = getDb()
    .prepare(
      `SELECT skill_slug AS skill, COUNT(*) AS runs
       FROM runs
       WHERE duration_ms IS NOT NULL AND status = 'done'
       GROUP BY skill_slug
       ORDER BY runs DESC
       LIMIT ?`
    )
    .all(limit) as { skill: string; runs: number }[];
  const durStmt = getDb().prepare(
    `SELECT duration_ms FROM runs
     WHERE skill_slug = ? AND duration_ms IS NOT NULL AND status = 'done'
     ORDER BY duration_ms ASC`
  );
  return skills.map(({ skill, runs }) => {
    const rows = durStmt.all(skill) as { duration_ms: number }[];
    const xs = rows.map((r) => r.duration_ms);
    return {
      skill,
      runs,
      p50Ms: percentile(xs, 0.5),
      p95Ms: percentile(xs, 0.95),
    };
  });
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.floor(p * (sortedAsc.length - 1)))
  );
  return sortedAsc[idx];
}
