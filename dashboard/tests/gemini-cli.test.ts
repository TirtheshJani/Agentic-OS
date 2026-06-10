import { describe, it, expect } from "vitest";
import { geminiCliRuntime } from "@/lib/runtime/gemini-cli";
import { claudeCodeRuntime } from "@/lib/runtime/claude-code";

describe("gemini-cli runtime", () => {
  it("declares the expected identity", () => {
    expect(geminiCliRuntime.id).toBe("gemini-cli");
    expect(geminiCliRuntime.displayName).toBe("Gemini CLI");
  });

  it("declares honest capabilities (no hooks, no terminal escape)", () => {
    expect(geminiCliRuntime.capabilities).toEqual({
      sessionResume: false,
      sessionIdCapture: true,
      hooks: false,
      transcriptCostParsing: false,
      externalTerminalEscape: false,
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

  it("formats a resume command even though resume is capability-gated off", () => {
    expect(geminiCliRuntime.formatResumeCommand("anything")).toContain("gemini");
  });
});

describe("claude-code capabilities", () => {
  it("declares hook and resume support", () => {
    expect(claudeCodeRuntime.capabilities.hooks).toBe(true);
    expect(claudeCodeRuntime.capabilities.sessionIdCapture).toBe(true);
    expect(claudeCodeRuntime.capabilities.sessionResume).toBe(true);
    expect(claudeCodeRuntime.capabilities.externalTerminalEscape).toBe(true);
  });
});
