#!/usr/bin/env node
// ao-hook — forwarder for ~/.claude/settings.json SessionStart/Stop hooks.
// Reads the hook JSON from stdin, POSTs to the dashboard /api/session-log
// so the session shows up next to dashboard-spawned runs.
//
// Install (add to ~/.claude/settings.json):
//
//   {
//     "hooks": {
//       "SessionStart": [{
//         "hooks": [{
//           "type": "command",
//           "command": "node C:\\Users\\TJ\\Documents\\GitHub\\Agentic-OS\\bin\\ao-hook.mjs start"
//         }]
//       }],
//       "Stop": [{
//         "hooks": [{
//           "type": "command",
//           "command": "node C:\\Users\\TJ\\Documents\\GitHub\\Agentic-OS\\bin\\ao-hook.mjs stop"
//         }]
//       }]
//     }
//   }
//
// The hook payload is read from stdin. If the dashboard isn't running, this
// exits silently — hooks should never block your session.

const DEFAULT_SERVER = process.env.AGENTIC_OS_DASHBOARD ?? "http://localhost:3000";
const TIMEOUT_MS = 800;

function readStdin() {
  return new Promise((resolve) => {
    let buf = "";
    if (process.stdin.isTTY) return resolve("");
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      buf += chunk;
    });
    process.stdin.on("end", () => resolve(buf));
    process.stdin.on("error", () => resolve(buf));
  });
}

async function postWithTimeout(url, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    // Dashboard not running, network error, timeout — swallow. Hooks must
    // not block or fail the user's session.
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const event = process.argv[2] === "stop" ? "stop" : "start";
  const raw = await readStdin();
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }
  // Claude Code hook payloads expose session_id and cwd; field names may vary
  // across versions, so accept either snake_case or camelCase.
  const sessionId = payload.session_id ?? payload.sessionId;
  if (!sessionId) {
    process.exit(0);
  }
  const body = {
    event,
    sessionId,
    cwd: payload.cwd ?? payload.working_directory ?? null,
    source: payload.source ?? null,
    transcriptPath: payload.transcript_path ?? payload.transcriptPath ?? null,
  };
  await postWithTimeout(`${DEFAULT_SERVER}/api/session-log`, body);
  process.exit(0);
}

main().catch(() => process.exit(0));
