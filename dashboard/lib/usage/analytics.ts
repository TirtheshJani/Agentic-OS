// dashboard/lib/usage/analytics.ts
// SQL aggregation over the sessions/runs/issues tables (spec 0018). No cached
// aggregate files: at hundreds of rows, GROUP BY is instant.
import { getDb } from "@/lib/db";
import { estimateCost, priceFor } from "@/lib/usage/pricing";
import type { ModelUsage } from "@/lib/sessions/parseClaude";

export interface AnalyticsFilters {
  from?: number;
  to?: number;
  provider?: string;
  projectSlug?: string;
}

export interface AnalyticsResult {
  daily: Array<{
    day: string;
    tokensIn: number;
    tokensOut: number;
    cacheRead: number;
    cacheWrite: number;
    sessions: number;
    cost: number | null;
  }>;
  byModel: Array<{ model: string; tokensIn: number; tokensOut: number; turns: number; cost: number | null }>;
  byProject: Array<{ projectSlug: string; sessions: number; tokensIn: number; tokensOut: number; cost: number | null }>;
  runOutcomes: Array<{ day: string; done: number; failed: number }>;
  issueThroughput: Array<{ day: string; created: number; closed: number }>;
  totals: {
    sessions: number;
    tokensIn: number;
    tokensOut: number;
    cost: number | null;
    runsDone: number;
    runsFailed: number;
  };
}

function sessionWhere(f: AnalyticsFilters): { sql: string; params: unknown[] } {
  const clauses: string[] = ["1=1"];
  const params: unknown[] = [];
  if (f.from) {
    clauses.push("started_at >= ?");
    params.push(f.from);
  }
  if (f.to) {
    clauses.push("started_at <= ?");
    params.push(f.to);
  }
  if (f.provider) {
    clauses.push("provider = ?");
    params.push(f.provider);
  }
  if (f.projectSlug) {
    clauses.push("project_slug = ?");
    params.push(f.projectSlug);
  }
  return { sql: clauses.join(" AND "), params };
}

export function getAnalytics(f: AnalyticsFilters = {}): AnalyticsResult {
  const db = getDb();
  const { sql, params } = sessionWhere(f);

  const daily = db
    .prepare(
      `SELECT date(started_at / 1000, 'unixepoch') AS day,
              COALESCE(SUM(tokens_in), 0) AS tokensIn,
              COALESCE(SUM(tokens_out), 0) AS tokensOut,
              COALESCE(SUM(tokens_cache_read), 0) AS cacheRead,
              COALESCE(SUM(tokens_cache_write), 0) AS cacheWrite,
              COUNT(*) AS sessions,
              SUM(cost_estimate) AS cost
       FROM sessions WHERE ${sql} AND started_at IS NOT NULL
       GROUP BY day ORDER BY day`
    )
    .all(...params) as AnalyticsResult["daily"];

  // Per-model rollup from the JSON models column, aggregated in JS.
  const modelRows = db.prepare(`SELECT models FROM sessions WHERE ${sql}`).all(...params) as Array<{ models: string | null }>;
  const byModelMap = new Map<string, ModelUsage>();
  for (const row of modelRows) {
    if (!row.models) continue;
    let parsed: Record<string, ModelUsage>;
    try {
      parsed = JSON.parse(row.models) as Record<string, ModelUsage>;
    } catch {
      continue;
    }
    for (const [model, u] of Object.entries(parsed)) {
      const agg = byModelMap.get(model) ?? { in: 0, out: 0, cacheWrite: 0, cacheRead: 0, turns: 0 };
      agg.in += u.in;
      agg.out += u.out;
      agg.cacheWrite += u.cacheWrite;
      agg.cacheRead += u.cacheRead;
      agg.turns += u.turns;
      byModelMap.set(model, agg);
    }
  }
  const byModel = [...byModelMap.entries()]
    .map(([model, u]) => ({
      model,
      tokensIn: u.in,
      tokensOut: u.out,
      turns: u.turns,
      cost: priceFor(model) ? estimateCost({ [model]: u }) : null,
    }))
    .sort((a, b) => b.tokensOut - a.tokensOut);

  const byProject = db
    .prepare(
      `SELECT project_slug AS projectSlug, COUNT(*) AS sessions,
              COALESCE(SUM(tokens_in), 0) AS tokensIn,
              COALESCE(SUM(tokens_out), 0) AS tokensOut,
              SUM(cost_estimate) AS cost
       FROM sessions WHERE ${sql} AND project_slug IS NOT NULL
       GROUP BY project_slug ORDER BY tokensOut DESC`
    )
    .all(...params) as AnalyticsResult["byProject"];

  const runParams: unknown[] = [];
  let runWhere = "ended_at IS NOT NULL";
  if (f.from) {
    runWhere += " AND ended_at >= ?";
    runParams.push(f.from);
  }
  if (f.to) {
    runWhere += " AND ended_at <= ?";
    runParams.push(f.to);
  }
  const runOutcomes = db
    .prepare(
      `SELECT date(ended_at / 1000, 'unixepoch') AS day,
              SUM(CASE WHEN exit_status = 'done' THEN 1 ELSE 0 END) AS done,
              SUM(CASE WHEN exit_status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM runs WHERE ${runWhere} GROUP BY day ORDER BY day`
    )
    .all(...runParams) as AnalyticsResult["runOutcomes"];

  const issueParams: unknown[] = [];
  let issueWhere = "1=1";
  if (f.from) {
    issueWhere += " AND created_at >= ?";
    issueParams.push(f.from);
  }
  if (f.to) {
    issueWhere += " AND created_at <= ?";
    issueParams.push(f.to);
  }
  // "closed" approximates: status currently done, bucketed by last update.
  const issueThroughput = db
    .prepare(
      `SELECT day, SUM(created) AS created, SUM(closed) AS closed FROM (
         SELECT date(created_at / 1000, 'unixepoch') AS day, 1 AS created, 0 AS closed
         FROM issues WHERE ${issueWhere}
         UNION ALL
         SELECT date(updated_at / 1000, 'unixepoch') AS day, 0 AS created, 1 AS closed
         FROM issues WHERE status = 'done'
       ) GROUP BY day ORDER BY day`
    )
    .all(...issueParams) as AnalyticsResult["issueThroughput"];

  const totalsRow = db
    .prepare(
      `SELECT COUNT(*) AS sessions,
              COALESCE(SUM(tokens_in), 0) AS tokensIn,
              COALESCE(SUM(tokens_out), 0) AS tokensOut,
              SUM(cost_estimate) AS cost
       FROM sessions WHERE ${sql}`
    )
    .get(...params) as { sessions: number; tokensIn: number; tokensOut: number; cost: number | null };
  const runTotals = db
    .prepare(
      `SELECT SUM(CASE WHEN exit_status = 'done' THEN 1 ELSE 0 END) AS done,
              SUM(CASE WHEN exit_status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM runs WHERE ${runWhere}`
    )
    .get(...runParams) as { done: number | null; failed: number | null };

  return {
    daily,
    byModel,
    byProject,
    runOutcomes,
    issueThroughput,
    totals: {
      sessions: totalsRow.sessions,
      tokensIn: totalsRow.tokensIn,
      tokensOut: totalsRow.tokensOut,
      cost: totalsRow.cost,
      runsDone: runTotals.done ?? 0,
      runsFailed: runTotals.failed ?? 0,
    },
  };
}
