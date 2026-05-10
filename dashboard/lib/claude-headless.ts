import { spawn } from "node:child_process";
import { allowedRunCwds, repoRoot } from "./paths";

export type ClaudeEvent =
  | { type: "delta"; data: string }
  | { type: "tool"; data: { name: string; input?: unknown } }
  | { type: "done"; data: { outputPath: string | null } }
  | { type: "error"; data: { message: string } };

const WRITE_PATTERNS = [
  /(?:wrote|created|saved)(?: to)?\s+([\w./\-]+\.md)/i,
  /file_path"?\s*:\s*"([^"]+\.md)"/,
];

export async function* runClaude(opts: {
  prompt: string;
  cwd?: string;
}): AsyncGenerator<ClaudeEvent> {
  if (opts.prompt.length > 32_000) {
    yield { type: "error", data: { message: "prompt too large" } };
    return;
  }
  const cwd = opts.cwd ?? repoRoot;
  if (!allowedRunCwds.has(cwd)) {
    yield { type: "error", data: { message: `cwd not allowed: ${cwd}` } };
    return;
  }

  const child = spawn(
    "claude",
    ["-p", opts.prompt, "--output-format", "stream-json", "--verbose"],
    { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] }
  );

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
        const norm = normalize(evt);
        if (norm) {
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

function normalize(evt: unknown): ClaudeEvent | null {
  if (!evt || typeof evt !== "object") return null;
  const e = evt as Record<string, unknown>;
  if (e.type === "assistant" && Array.isArray((e.message as { content?: unknown[] })?.content)) {
    const parts = (e.message as { content: Array<{ type: string; text?: string }> }).content;
    const text = parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
    if (text) return { type: "delta", data: text };
  }
  if (e.type === "tool_use" && typeof e.name === "string") {
    return {
      type: "tool",
      data: { name: e.name, input: e.input },
    };
  }
  if (typeof e.delta === "string") {
    return { type: "delta", data: e.delta };
  }
  return null;
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
