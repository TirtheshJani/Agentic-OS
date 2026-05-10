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
