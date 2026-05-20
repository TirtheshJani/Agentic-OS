import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths";
import { isCwdAllowed } from "./run-guards";

// Resolve the claude CLI binary. On Windows the executable is often bundled
// inside the VS Code extension and not on PATH. Set CLAUDE_BIN in .env.local
// to override (full path including .exe on Windows).
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? "claude";

// Resolve CLAUDE_BIN to an absolute path once at module load. With an
// absolute path in hand we can spawn with shell:false and pass argv cleanly,
// avoiding cmd.exe's metachar handling for `&`, `|`, `^`, `"` on Windows.
// If the resolver can't find the binary we fall back to the legacy
// shell-spawn path so existing setups keep working.
const RESOLVED_CLAUDE_BIN = resolveClaudeBin(CLAUDE_BIN);

function resolveClaudeBin(bin: string): string | null {
  // Already absolute and exists: trust the caller.
  if (path.isAbsolute(bin) && fs.existsSync(bin)) return bin;
  const isWin = process.platform === "win32";
  const cmd = isWin ? "where" : "which";
  // On Windows, `where claude` may print several lines (e.g. claude.cmd and
  // claude). Take the first hit and prefer .cmd / .exe for argv handling.
  try {
    const res = spawnSync(cmd, [bin], { encoding: "utf8" });
    if (res.status !== 0) return null;
    const lines = res.stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return null;
    if (isWin) {
      const cmdHit = lines.find((l) => l.toLowerCase().endsWith(".cmd"));
      const exeHit = lines.find((l) => l.toLowerCase().endsWith(".exe"));
      return cmdHit ?? exeHit ?? lines[0];
    }
    return lines[0];
  } catch {
    return null;
  }
}

export type UsageSnapshot = {
  tokens_in?: number;
  tokens_out?: number;
  tokens_cache_read?: number;
  tokens_cache_create?: number;
  cost_usd?: number;
};

export type ClaudeEvent =
  | { type: "delta"; data: string }
  | { type: "tool"; data: { name: string; input?: unknown } }
  | { type: "usage"; data: UsageSnapshot }
  | { type: "done"; data: { outputPath: string | null } }
  | { type: "error"; data: { message: string } }
  | {
      type: "handoff";
      data: {
        assignee: string;
        prompt: string;
        parentTaskId?: number;
        // null = explicit "no project"; undefined = no override (inherit from parent).
        projectSlug?: string | null;
      };
    };

const WRITE_PATTERNS = [
  /(?:wrote|created|saved)(?: to)?\s+([\w./\-]+\.md)/i,
  /file_path"?\s*:\s*"([^"]+\.md)"/,
];

export async function* runClaude(opts: {
  prompt: string;
  cwd?: string;
  mcpConfigPath?: string;
  appendSystemPrompt?: string;
  extraEnv?: Record<string, string>;
  signal?: AbortSignal;
  model?: string;
}): AsyncGenerator<ClaudeEvent> {
  if (opts.prompt.length > 32_000) {
    yield { type: "error", data: { message: "prompt too large" } };
    return;
  }
  const cwd = opts.cwd ?? repoRoot;
  if (!isCwdAllowed(cwd)) {
    yield { type: "error", data: { message: `cwd not allowed: ${cwd}` } };
    return;
  }

  const args = ["-p", opts.prompt, "--output-format", "stream-json", "--verbose"];
  if (opts.mcpConfigPath) args.push("--mcp-config", opts.mcpConfigPath);
  if (opts.appendSystemPrompt) args.push("--append-system-prompt", opts.appendSystemPrompt);
  if (opts.model) args.push("--model", opts.model);

  const env = { ...process.env, ...(opts.extraEnv ?? {}) };

  // Prefer the resolved absolute path with shell:false so argv is passed
  // verbatim to the binary. The legacy shell-spawn branch is only taken when
  // we could not resolve the path at module load (e.g. fresh dev box without
  // claude on PATH yet); in that case cmd.exe handles the .cmd shim lookup,
  // accepting the metachar risk noted in the audit.
  const useResolved = RESOLVED_CLAUDE_BIN !== null;
  const child = spawn(useResolved ? RESOLVED_CLAUDE_BIN! : CLAUDE_BIN, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: useResolved
      ? false
      : !CLAUDE_BIN.includes("/") && !CLAUDE_BIN.includes("\\"),
  });

  const killChild = () => {
    if (!child.killed) {
      try {
        child.kill();
      } catch {
        // already exited
      }
    }
  };
  opts.signal?.addEventListener("abort", killChild);

  const queue: ClaudeEvent[] = [];
  let done = false;
  let err: string | null = null;
  let outputPath: string | null = null;
  const fullText: string[] = [];

  // Event-driven wakeup. Producers (stdout/stderr/close/error) push to the
  // queue and call `wake()`; the consumer loop awaits `wait()` which resolves
  // on the next wake. This replaces a 50ms setTimeout busy-wait that
  // otherwise added latency and woke the event loop constantly even when
  // claude was idle.
  let wakeResolve: (() => void) | null = null;
  const wake = () => {
    if (wakeResolve) {
      const r = wakeResolve;
      wakeResolve = null;
      r();
    }
  };
  const wait = (): Promise<void> =>
    new Promise<void>((resolve) => {
      wakeResolve = resolve;
    });

  let buf = "";
  child.stdout.on("data", (chunk: Buffer) => {
    buf += chunk.toString("utf8");
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        const evt = JSON.parse(line);
        const events = normalizeAll(evt);
        if (events.length > 0) {
          for (const norm of events) {
            if (norm.type === "delta") {
              fullText.push(norm.data);
              const path = scanForWrite(norm.data);
              if (path) outputPath = path;
              const handoff = scanForHandoff(norm.data);
              if (handoff) queue.push({ type: "handoff", data: handoff });
            }
            if (norm.type === "tool") {
              const input = (norm.data.input ?? {}) as Record<string, unknown>;
              if (typeof input.file_path === "string") outputPath = input.file_path;
            }
            queue.push(norm);
          }
        } else {
          queue.push({ type: "delta", data: line });
          fullText.push(line);
        }
      } catch (e) {
        console.warn(
          `[runClaude] non-JSON stdout line treated as text: ${e instanceof Error ? e.message : String(e)}`
        );
        queue.push({ type: "delta", data: line });
        fullText.push(line);
      }
    }
    wake();
  });

  child.stderr.on("data", (chunk: Buffer) => {
    queue.push({ type: "delta", data: chunk.toString("utf8") });
    wake();
  });

  child.on("error", (e) => {
    err = e.message;
    done = true;
    wake();
  });

  child.on("close", (code) => {
    if (code !== 0 && !err) err = `claude exited with code ${code}`;
    done = true;
    wake();
  });

  try {
    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }
      if (done) {
        if (err) yield { type: "error", data: { message: err } };
        else yield { type: "done", data: { outputPath } };
        return;
      }
      await wait();
    }
  } finally {
    // Runs on normal completion, generator.return() (consumer abandoned the
    // iterator), or generator.throw(). Ensures the child does not outlive
    // the caller, even if the SSE client disconnects mid-stream.
    opts.signal?.removeEventListener("abort", killChild);
    killChild();
  }
}

function normalizeAll(evt: unknown): ClaudeEvent[] {
  if (!evt || typeof evt !== "object") return [];
  const e = evt as Record<string, unknown>;
  const out: ClaudeEvent[] = [];

  if (e.type === "assistant") {
    const msg = e.message as
      | { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }>; usage?: Record<string, number> }
      | undefined;
    if (Array.isArray(msg?.content)) {
      const text = msg!.content
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("");
      if (text) out.push({ type: "delta", data: text });
      for (const p of msg!.content) {
        if (p.type === "tool_use" && typeof p.name === "string") {
          out.push({ type: "tool", data: { name: p.name, input: p.input } });
        }
      }
    }
    const usage = pickUsage(msg?.usage);
    if (usage) out.push({ type: "usage", data: usage });
  }

  if (e.type === "result") {
    const usage = pickUsage(e.usage as Record<string, number> | undefined);
    const cost = typeof e.total_cost_usd === "number" ? e.total_cost_usd : undefined;
    if (usage || cost !== undefined) {
      out.push({ type: "usage", data: { ...(usage ?? {}), ...(cost !== undefined ? { cost_usd: cost } : {}) } });
    }
  }

  if (e.type === "tool_use" && typeof e.name === "string") {
    out.push({ type: "tool", data: { name: e.name, input: e.input } });
  }
  if (typeof e.delta === "string") {
    out.push({ type: "delta", data: e.delta });
  }
  return out;
}

function pickUsage(u: Record<string, number> | undefined): UsageSnapshot | null {
  if (!u || typeof u !== "object") return null;
  const snap: UsageSnapshot = {};
  if (typeof u.input_tokens === "number") snap.tokens_in = u.input_tokens;
  if (typeof u.output_tokens === "number") snap.tokens_out = u.output_tokens;
  if (typeof u.cache_read_input_tokens === "number") snap.tokens_cache_read = u.cache_read_input_tokens;
  if (typeof u.cache_creation_input_tokens === "number") snap.tokens_cache_create = u.cache_creation_input_tokens;
  return Object.keys(snap).length ? snap : null;
}

function scanForWrite(text: string): string | null {
  for (const re of WRITE_PATTERNS) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

function scanForHandoff(
  text: string
): {
  assignee: string;
  prompt: string;
  parentTaskId?: number;
  projectSlug?: string | null;
} | null {
  const lines = text.split("\n");
  for (const line of lines) {
    const m = line.match(/^next-task:\s*(\{.+\})\s*$/);
    if (!m) continue;
    try {
      const obj = JSON.parse(m[1]) as Record<string, unknown>;
      const assignee = typeof obj.assignee === "string" ? obj.assignee : null;
      const promptText = typeof obj.prompt === "string" ? obj.prompt : null;
      const parent = typeof obj.parent_task_id === "number" ? obj.parent_task_id : undefined;
      // Accept either `projectSlug` or `project_slug` from the operator. Three
      // states matter downstream:
      //   - key absent          → undefined → inherit from parent task
      //   - key = string        → explicit override
      //   - key = null          → explicit "no project" (do not inherit)
      // Anything else (number, array, etc.) is treated as "key absent".
      const rawProject =
        "projectSlug" in obj
          ? obj.projectSlug
          : "project_slug" in obj
            ? obj.project_slug
            : undefined;
      let projectSlug: string | null | undefined;
      if (rawProject === undefined) {
        projectSlug = undefined;
      } else if (rawProject === null) {
        projectSlug = null;
      } else if (typeof rawProject === "string") {
        projectSlug = rawProject;
      } else {
        projectSlug = undefined;
      }
      if (assignee && promptText) {
        return { assignee, prompt: promptText, parentTaskId: parent, projectSlug };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

