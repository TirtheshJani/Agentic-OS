import { describe, it, expect } from "vitest";
import { geminiCliRuntime, geminiSpawnArgs } from "@/lib/runtime/gemini-cli";
import { claudeCodeRuntime, claudeSpawnArgs } from "@/lib/runtime/claude-code";
import { antigravityCliRuntime, agySpawnArgs } from "@/lib/runtime/antigravity-cli";

describe("gemini-cli runtime", () => {
  it("declares the expected identity", () => {
    expect(geminiCliRuntime.id).toBe("gemini-cli");
    expect(geminiCliRuntime.displayName).toBe("Gemini CLI");
  });

  it("declares honest capabilities (cwd-scoped resume, no hooks)", () => {
    // Verified against gemini-cli v0.46.0: --resume is "latest"/index (cwd
    // scoped), not UUID; no SessionStart-style hooks exist.
    expect(geminiCliRuntime.capabilities).toEqual({
      sessionResume: true,
      sessionIdCapture: true,
      hooks: false,
      transcriptCostParsing: false,
      externalTerminalEscape: true,
    });
  });

  it("detect() returns an availability shape without throwing", async () => {
    // Must not throw whether or not gemini is installed on the host.
    const availability = await geminiCliRuntime.detect();
    expect(typeof availability.available).toBe("boolean");
    if (availability.available) {
      expect(availability.version).toMatch(/\d+\.\d+\.\d+/);
    } else {
      expect(availability.version).toBeNull();
      expect(availability.error).toBeTruthy();
    }
  });

  it("resumes via cwd-scoped --resume latest (ignores the session-id marker)", () => {
    // gemini --resume takes "latest" or an index, not a UUID; the external
    // terminal opens in the run's worktree where "latest" is this run. Resume
    // carries --yolo --skip-trust so it keeps skipping prompts like spawn does.
    expect(geminiCliRuntime.formatResumeCommand("uuid-123")).toBe("gemini --resume latest --yolo --skip-trust");
  });
});

describe("claude-code capabilities", () => {
  it("declares hook and resume support", () => {
    expect(claudeCodeRuntime.capabilities.hooks).toBe(true);
    expect(claudeCodeRuntime.capabilities.sessionIdCapture).toBe(true);
    expect(claudeCodeRuntime.capabilities.sessionResume).toBe(true);
    expect(claudeCodeRuntime.capabilities.externalTerminalEscape).toBe(true);
  });
  it("declares transcript cost parsing (real usage parser exists)", () => {
    expect(claudeCodeRuntime.capabilities.transcriptCostParsing).toBe(true);
  });
});

describe("antigravity-cli runtime", () => {
  it("declares the expected identity", () => {
    expect(antigravityCliRuntime.id).toBe("antigravity-cli");
    expect(antigravityCliRuntime.displayName).toBe("Antigravity CLI");
  });

  it("declares honest capabilities (self-assigned id, no hooks)", () => {
    expect(antigravityCliRuntime.capabilities).toEqual({
      sessionResume: true,
      sessionIdCapture: false,
      hooks: false,
      transcriptCostParsing: false,
      externalTerminalEscape: true,
    });
  });

  it("detect() returns an availability shape without throwing", async () => {
    const availability = await antigravityCliRuntime.detect();
    expect(typeof availability.available).toBe("boolean");
    if (availability.available) {
      expect(availability.version).toMatch(/\d+\.\d+\.\d+/);
    } else {
      expect(availability.version).toBeNull();
      expect(availability.error).toBeTruthy();
    }
  });

  it("resumes via cwd-scoped --continue (ignores the marker id)", () => {
    expect(antigravityCliRuntime.formatResumeCommand("anything")).toBe("agy --continue --dangerously-skip-permissions");
  });
});

describe("spawn argv builders", () => {
  it("claude args omit --model by default and include it when set", () => {
    expect(claudeSpawnArgs()).toEqual(["--dangerously-skip-permissions"]);
    expect(claudeSpawnArgs("sonnet")).toEqual(["--dangerously-skip-permissions", "--model", "sonnet"]);
  });

  it("gemini args omit -m by default and include it when set", () => {
    expect(geminiSpawnArgs("sid-1")).toEqual(["--yolo", "--skip-trust", "--session-id", "sid-1"]);
    expect(geminiSpawnArgs("sid-1", "gemini-2.5-flash")).toEqual([
      "--yolo", "--skip-trust", "--session-id", "sid-1", "-m", "gemini-2.5-flash",
    ]);
  });

  it("both runtimes declare model choices for the editor dropdown", () => {
    expect(claudeCodeRuntime.models?.map(m => m.id)).toEqual(["opus", "sonnet", "haiku"]);
    expect(geminiCliRuntime.models?.map(m => m.id)).toEqual(["gemini-2.5-pro", "gemini-2.5-flash"]);
  });

  it("agy carries the prompt as a flag value and gates --model on presence", () => {
    expect(agySpawnArgs("do the thing")).toEqual([
      "--prompt-interactive", "do the thing", "--dangerously-skip-permissions",
    ]);
    expect(agySpawnArgs("do the thing", "gemini-3-pro")).toEqual([
      "--prompt-interactive", "do the thing", "--dangerously-skip-permissions", "--model", "gemini-3-pro",
    ]);
  });
});
