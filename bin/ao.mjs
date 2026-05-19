#!/usr/bin/env node
// ao — global prompter CLI for the Agentic OS dashboard.
// Talks to the running dashboard on http://localhost:3000 (override with
// AGENTIC_OS_DASHBOARD or --server). The dashboard must be running:
//   cd dashboard && npm run dev
//
// Commands:
//   ao prompt "..."           route + dispatch in one shot
//   ao run <slug> "..."       dispatch to a specific team
//   ao repos                  list known teams
//   ao runs                   show recent runs
//
// Flags:
//   --server <url>            override dashboard base URL
//   --no-llm                  router uses deterministic match only
//   --quiet                   suppress streamed output (just show summary)

const DEFAULT_SERVER = process.env.AGENTIC_OS_DASHBOARD ?? "http://localhost:3000";

function parseArgs(argv) {
  const out = { positional: [], server: DEFAULT_SERVER, allowLlm: true, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--server") {
      out.server = argv[++i];
    } else if (a === "--no-llm") {
      out.allowLlm = false;
    } else if (a === "--quiet" || a === "-q") {
      out.quiet = true;
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    } else {
      out.positional.push(a);
    }
  }
  return out;
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

async function streamRun(server, payload, { quiet }) {
  const res = await fetch(`${server}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`run failed: ${res.status} ${errText}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let runId = null;
  let usage = {};
  let lastErr = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 2);
      if (!chunk.startsWith("data:")) continue;
      const json = chunk.replace(/^data:\s*/, "");
      let evt;
      try { evt = JSON.parse(json); } catch { continue; }
      if (evt.type === "started") {
        runId = evt.runId;
        if (!quiet) process.stderr.write(`[run ${runId} cwd=${evt.cwd}]\n`);
      } else if (evt.type === "delta" && !quiet) {
        process.stdout.write(evt.data);
      } else if (evt.type === "tool" && !quiet) {
        process.stderr.write(`\n[tool: ${evt.data.name}]\n`);
      } else if (evt.type === "usage") {
        usage = { ...usage, ...evt.data };
      } else if (evt.type === "error") {
        lastErr = evt.data?.message ?? "unknown error";
        if (!quiet) process.stderr.write(`\n[error: ${lastErr}]\n`);
      } else if (evt.type === "done") {
        if (!quiet) process.stderr.write(`\n[done]\n`);
      }
    }
  }
  if (!quiet && Object.keys(usage).length > 0) {
    process.stderr.write(
      `[usage in=${usage.tokens_in ?? 0} out=${usage.tokens_out ?? 0} cache_r=${usage.tokens_cache_read ?? 0} cost_usd=${usage.cost_usd ?? 0}]\n`
    );
  }
  return { runId, usage, error: lastErr };
}

async function cmdRepos(server) {
  const { ok, body } = await fetchJson(`${server}/api/router`);
  if (!ok) {
    console.error("failed to list teams:", body);
    process.exit(1);
  }
  const teams = body.teams ?? [];
  if (teams.length === 0) {
    console.log("(no teams discovered)");
    return;
  }
  const padSlug = Math.max(...teams.map((t) => t.slug.length));
  for (const t of teams) {
    const tag = t.source === "project" ? "P" : "D";
    const desc = (t.description ?? "").slice(0, 80);
    console.log(`${tag} ${t.slug.padEnd(padSlug)}  ${desc}`);
  }
  console.log(`\n${teams.length} team(s)  (P=project, D=discovered)`);
}

async function cmdRuns(server) {
  const { ok, body } = await fetchJson(`${server}/api/runs`);
  if (!ok) {
    console.error("failed to list runs:", body);
    process.exit(1);
  }
  const runs = body.runs ?? [];
  for (const r of runs) {
    const start = new Date(r.started_at).toISOString().replace("T", " ").slice(0, 19);
    const dur = r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—";
    const status = r.status.padEnd(7);
    const slug = (r.project_slug ?? "—").padEnd(20);
    const prompt = (r.prompt ?? "").replace(/\s+/g, " ").slice(0, 60);
    console.log(`${start}  ${status}  ${slug}  ${dur.padStart(6)}  ${prompt}`);
  }
}

async function cmdRoute(server, prompt, allowLlm) {
  const { ok, body } = await fetchJson(`${server}/api/router`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, allowLlm }),
  });
  if (!ok) {
    return { ok: false, reason: body?.reason ?? `router returned ${body?.error ?? "error"}` };
  }
  return body;
}

async function cmdPrompt(server, prompt, { allowLlm, quiet }) {
  process.stderr.write("[routing…]\n");
  const route = await cmdRoute(server, prompt, allowLlm);
  if (!route.ok) {
    console.error(`router: no match (${route.reason})`);
    process.exit(2);
  }
  process.stderr.write(
    `[routed → ${route.name} (${route.slug}) via ${route.mode}: ${route.reason}]\n`
  );
  await streamRun(server, { teamSlug: route.slug, prompt }, { quiet });
}

async function cmdRun(server, slug, prompt, { quiet }) {
  await streamRun(server, { teamSlug: slug, prompt }, { quiet });
}

function help() {
  process.stdout.write(
    `ao — Agentic OS global prompter\n\n` +
      `Usage:\n` +
      `  ao prompt "what to do"          route and dispatch to the best team\n` +
      `  ao run <team-slug> "what to do" dispatch to a specific team\n` +
      `  ao repos                        list known teams (P=project, D=discovered)\n` +
      `  ao runs                         show recent runs\n\n` +
      `Flags:\n` +
      `  --server <url>   dashboard base URL (default ${DEFAULT_SERVER})\n` +
      `  --no-llm         router uses deterministic match only\n` +
      `  --quiet, -q      suppress streamed output\n\n` +
      `The dashboard must be running:  (cd dashboard && npm run dev)\n`
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.positional.length === 0) {
    help();
    process.exit(args.positional.length === 0 ? 1 : 0);
  }
  const [cmd, ...rest] = args.positional;
  try {
    if (cmd === "prompt") {
      const prompt = rest.join(" ").trim();
      if (!prompt) throw new Error("prompt required");
      await cmdPrompt(args.server, prompt, args);
    } else if (cmd === "run") {
      const [slug, ...promptParts] = rest;
      const prompt = promptParts.join(" ").trim();
      if (!slug || !prompt) throw new Error("usage: ao run <team-slug> \"prompt\"");
      await cmdRun(args.server, slug, prompt, args);
    } else if (cmd === "repos" || cmd === "teams") {
      await cmdRepos(args.server);
    } else if (cmd === "runs") {
      await cmdRuns(args.server);
    } else {
      console.error(`unknown command: ${cmd}`);
      help();
      process.exit(1);
    }
  } catch (e) {
    console.error(`ao: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

main();
