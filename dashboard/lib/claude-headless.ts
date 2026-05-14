import { spawn } from "node:child_process";
import { repoRoot } from "./paths";
import { isCwdAllowed } from "./run-guards";

// Resolve the claude CLI binary. On Windows the executable is often bundled
// inside the VS Code extension and not on PATH. Set CLAUDE_BIN in .env.local
// to override (full path including .exe on Windows).
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? "claude";

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
  | { type: "error"; data: { message: string } };

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

  const env = { ...process.env, ...(opts.extraEnv ?? {}) };

  const child = spawn(CLAUDE_BIN, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    // shell: true lets Windows resolve .cmd wrappers and PATH entries that
    // are not visible to Node's direct spawn. Only needed when CLAUDE_BIN
    // is a plain name (not an absolute path).
    shell: !CLAUDE_BIN.includes("/") && !CLAUDE_BIN.includes("\\"),
  });

  const queue: ClaudeEvent[] = [];
  let done = false;
  let err: string | null = null;
  let outputPath: string | null = null;
  const fullText: string[] = [];

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
      } catch {
        queue.push({ type: "delta", data: line });
        fullText.push(line);
      }
    }
  });

  child.stderr.on("data", (chunk: Buffer) => {
    queue.push({ type: "delta", data: chunk.toString("utf8") });
  });

  child.on("error", (e) => {
    err = e.message;
    done = true;
  });

  child.on("close", (code) => {
    if (code !== 0 && !err) err = `claude exited with code ${code}`;
    done = true;
  });

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
    await sleep(50);
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
