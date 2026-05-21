#!/usr/bin/env node
// This script is invoked by Claude Code's SessionStart hook.
// Hook input arrives as JSON on stdin. We forward the session_id to the dashboard
// via a known callback URL set in env at install time.
const http = require("node:http");
const https = require("node:https");

let raw = "";
process.stdin.on("data", chunk => raw += chunk);
process.stdin.on("end", () => {
  // stderr is fine to write to; SessionStart's stdout becomes injected context, but stderr is free.
  process.stderr.write(`[claude-session-hook] fired, raw bytes=${raw.length}\n`);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    process.exit(0); // Don't break the session for hook parse errors.
  }
  const sessionId = parsed.session_id;
  // Args passed by the installed command line. Using argv (not env vars) keeps
  // the hook command portable across bash and cmd.exe; the bash-style
  // VAR=value prefix does not work on Windows native.
  const callback = process.argv[2];
  const runId = process.argv[3];
  if (!sessionId || !callback || !runId) {
    process.exit(0);
  }
  const url = new URL(callback);
  const body = JSON.stringify({ runId: parseInt(runId, 10), sessionId, transcriptPath: parsed.transcript_path ?? null });
  const lib = url.protocol === "https:" ? https : http;
  const req = lib.request({
    method: "POST",
    hostname: url.hostname,
    port: url.port || (url.protocol === "https:" ? 443 : 80),
    path: url.pathname + url.search,
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
  }, res => {
    res.resume();
    res.on("end", () => process.exit(0));
  });
  req.on("error", () => process.exit(0)); // Silent failure; fallback path will catch.
  req.write(body);
  req.end();
});

// Don't add anything to stdout; SessionStart stdout is injected as context.
