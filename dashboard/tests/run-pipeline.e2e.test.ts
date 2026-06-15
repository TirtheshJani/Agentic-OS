import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Runtime, SpawnedRun } from "@/lib/runtime/types";
import { claudeCodeRuntime } from "@/lib/runtime/claude-code";
import { geminiCliRuntime } from "@/lib/runtime/gemini-cli";
import { antigravityCliRuntime } from "@/lib/runtime/antigravity-cli";

// End-to-end proof of the run-spawn pipeline using a stub CLI in place of a real
// claude/gemini/agy. It validates the exact things that were broken: the runtime
// actually launches a process (on Windows the stub is a .cmd, so this exercises
// the cmd.exe-wrapping fix in resolveLaunch), the process runs in the worktree
// cwd, it RECEIVES the task prompt (typed into the PTY for claude/gemini, passed
// as argv for agy), and the PTY exits so the run can be finalized.

let WORK: string;
let stubPath: string;

const ENV_KEYS = [
  "AGENTIC_OS_CLAUDE_BIN",
  "AGENTIC_OS_GEMINI_BIN",
  "AGENTIC_OS_AGY_BIN",
  "AGENTIC_OS_PROMPT_SETTLE_MS",
  "AGENTIC_OS_PROMPT_MAXWAIT_MS",
  "STUB_MARKER",
  "STUB_READ_STDIN",
];

function writeStub(dir: string): string {
  if (process.platform === "win32") {
    const p = path.join(dir, "cli-stub.cmd");
    fs.writeFileSync(
      p,
      [
        "@echo off",
        "echo READY",
        'set "line="',
        'if "%STUB_READ_STDIN%"=="1" set /p line=',
        '> "%STUB_MARKER%" (',
        "  echo CWD=%CD%",
        "  echo ARGS=%*",
        "  echo STDIN=%line%",
        ")",
        "",
      ].join("\r\n")
    );
    return p;
  }
  const p = path.join(dir, "cli-stub.sh");
  fs.writeFileSync(
    p,
    [
      "#!/bin/sh",
      "echo READY",
      'line=""',
      'if [ "$STUB_READ_STDIN" = "1" ]; then IFS= read -r line; fi',
      "{",
      '  printf "CWD=%s\\n" "$(pwd)"',
      '  printf "ARGS=%s\\n" "$*"',
      '  printf "STDIN=%s\\n" "$line"',
      "} > \"$STUB_MARKER\"",
      "",
    ].join("\n")
  );
  fs.chmodSync(p, 0o755);
  return p;
}

function parseMarker(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1).trim();
  }
  return out;
}

function waitForExit(spawned: SpawnedRun, ms: number): Promise<{ exitCode: number }> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("stub CLI did not exit within the test window")), ms);
    spawned.pty.onExit((e) => {
      clearTimeout(t);
      resolve(e);
    });
  });
}

/** Spawn the stub through a runtime and return the marker the stub recorded. */
async function runViaStub(opts: {
  runtime: Runtime;
  binEnvKey: string;
  prompt: string;
  readStdin: boolean;
}): Promise<{ marker: Record<string, string>; exitCode: number }> {
  const marker = path.join(WORK, `marker-${opts.runtime.id}.txt`);
  process.env[opts.binEnvKey] = stubPath;
  process.env.STUB_MARKER = marker;
  process.env.STUB_READ_STDIN = opts.readStdin ? "1" : "0";

  const spawned = await opts.runtime.spawn({
    worktreePath: WORK,
    initialPrompt: opts.prompt,
    runId: 1,
    issueId: 1,
    projectSlug: "x",
  });
  const exit = await waitForExit(spawned, 12_000);
  await spawned.cleanup();
  // The stub writes the marker just before exiting; give the FS write a beat.
  for (let i = 0; i < 50 && !fs.existsSync(marker); i++) await new Promise((r) => setTimeout(r, 20));
  return { marker: parseMarker(fs.readFileSync(marker, "utf8")), exitCode: exit.exitCode };
}

function sameDir(a: string, b: string): boolean {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch {
    return path.resolve(a) === path.resolve(b);
  }
}

beforeEach(() => {
  WORK = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-e2e-"));
  stubPath = writeStub(WORK);
  // Make settle/backstop fast so the typed-prompt path resolves quickly.
  process.env.AGENTIC_OS_PROMPT_SETTLE_MS = "150";
  process.env.AGENTIC_OS_PROMPT_MAXWAIT_MS = "3000";
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  fs.rmSync(WORK, { recursive: true, force: true });
});

describe("run pipeline e2e (stub CLI through the real runtimes)", () => {
  it("gemini: launches in the worktree, receives the typed prompt, and exits", async () => {
    const prompt = "implement the parser carefully";
    const { marker, exitCode } = await runViaStub({
      runtime: geminiCliRuntime,
      binEnvKey: "AGENTIC_OS_GEMINI_BIN",
      prompt,
      readStdin: true,
    });
    expect(exitCode).toBe(0);
    expect(sameDir(marker.CWD, WORK)).toBe(true); // ran in the worktree
    expect(marker.STDIN).toBe(prompt); // the task was actually delivered
    expect(marker.ARGS).toContain("--session-id"); // gemini argv reached the CLI
  });

  it("claude: launches in the worktree, receives the typed prompt, and exits", async () => {
    const prompt = "write the failing test first then make it pass";
    const { marker, exitCode } = await runViaStub({
      runtime: claudeCodeRuntime,
      binEnvKey: "AGENTIC_OS_CLAUDE_BIN",
      prompt,
      readStdin: true,
    });
    expect(exitCode).toBe(0);
    expect(sameDir(marker.CWD, WORK)).toBe(true);
    expect(marker.STDIN).toBe(prompt);
    expect(marker.ARGS).toContain("--dangerously-skip-permissions");
  });

  it("antigravity: launches in the worktree and receives the prompt as argv", async () => {
    // Simple prompt (no shell metacharacters): on Windows the stub is a .cmd, so
    // the argv is re-parsed by cmd.exe here; in production agy is a real .exe and
    // the argv is passed verbatim, so arbitrary prompts are safe there.
    const prompt = "do the task now";
    const { marker, exitCode } = await runViaStub({
      runtime: antigravityCliRuntime,
      binEnvKey: "AGENTIC_OS_AGY_BIN",
      prompt,
      readStdin: false,
    });
    expect(exitCode).toBe(0);
    expect(sameDir(marker.CWD, WORK)).toBe(true);
    expect(marker.ARGS).toContain("--prompt-interactive");
    expect(marker.ARGS).toContain(prompt);
  });
});
