import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { installSessionStartHook } from "@/lib/runtime/hookInstaller";

let WORK: string;

beforeEach(() => {
  WORK = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-hook-"));
});

afterEach(() => {
  fs.rmSync(WORK, { recursive: true, force: true });
});

describe("installSessionStartHook", () => {
  it("creates .claude/settings.local.json with a SessionStart hook", () => {
    installSessionStartHook({
      worktreePath: WORK,
      hookScriptPath: "/abs/path/to/hook.js",
      callbackUrl: "http://localhost:3000/api/runs/42/hook",
      runId: 42,
    });
    const settings = JSON.parse(fs.readFileSync(path.join(WORK, ".claude", "settings.local.json"), "utf8"));
    expect(settings.hooks).toBeTruthy();
    expect(settings.hooks.SessionStart).toBeTruthy();
    const hookEntry = settings.hooks.SessionStart[0].hooks[0];
    expect(hookEntry.type).toBe("command");
    expect(hookEntry.command).toContain("/abs/path/to/hook.js");
    expect(hookEntry.command).toContain("http://localhost:3000/api/runs/42/hook");
    expect(hookEntry.command).toMatch(/\b42\b/);
    // Sanity: no bash-only env-prefix syntax leaked back in.
    expect(hookEntry.command).not.toContain("AGENTIC_OS_HOOK_CALLBACK=");
  });

  it("preserves existing settings.local.json fields", () => {
    fs.mkdirSync(path.join(WORK, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(WORK, ".claude", "settings.local.json"),
      JSON.stringify({ env: { FOO: "bar" } })
    );
    installSessionStartHook({
      worktreePath: WORK,
      hookScriptPath: "/x",
      callbackUrl: "http://x",
      runId: 1,
    });
    const settings = JSON.parse(fs.readFileSync(path.join(WORK, ".claude", "settings.local.json"), "utf8"));
    expect(settings.env.FOO).toBe("bar");
    expect(settings.hooks.SessionStart).toBeTruthy();
  });
});
