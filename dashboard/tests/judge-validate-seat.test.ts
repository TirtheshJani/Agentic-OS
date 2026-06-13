import { TEST_REPO_ROOT } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import { getSettings, resetSettingsForTesting, setSettings } from "@/lib/settings";
import { resolveJudgeProvider } from "@/lib/evals/judge";
import { resolveImplementRuntime } from "@/lib/startRun";

beforeEach(() => {
  // Unique state dir per test: setSettings persists to disk, so a stale
  // settings.json from a prior test would otherwise leak the validate seat.
  process.env.AGENTIC_OS_STATE_DIR = path.join(
    TEST_REPO_ROOT,
    `.agentic-os-${Date.now()}-${Math.random()}`,
  );
  resetSettingsForTesting();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetSettingsForTesting();
});

describe("resolveJudgeProvider validate seat (spec 0033, ADR-026)", () => {
  it("routes the judge to claude-cli when validate is claude-code", () => {
    setSettings({ roleAssignment: { validate: "claude-code" } });
    expect(resolveJudgeProvider()).toBe("claude-cli");
  });

  it("routes the judge to gemini-cli when validate is gemini-cli", () => {
    setSettings({ roleAssignment: { validate: "gemini-cli" } });
    expect(resolveJudgeProvider()).toBe("gemini-cli");
  });

  it("logs one downgrade and falls back to the inherit chain for a runtime with no answer CLI", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    // validate maps to null (antigravity has no one-shot -p), so the result is
    // the inherit chain: default rag.answerProvider is "gemini-cli".
    setSettings({ roleAssignment: { validate: "antigravity-cli" } });
    expect(resolveJudgeProvider()).toBe("gemini-cli");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("antigravity-cli");
  });

  it("is identical to the pre-existing inherit chain when validate is unset (regression)", () => {
    // Unset seat: default judgeProvider "inherit" -> rag.answerProvider "gemini-cli".
    expect(resolveJudgeProvider()).toBe("gemini-cli");
    // And it tracks an explicit judgeProvider override unchanged.
    setSettings({ evals: { ...getSettings().evals, judgeProvider: "claude-cli" } });
    expect(resolveJudgeProvider()).toBe("claude-cli");
    setSettings({ evals: { ...getSettings().evals, judgeProvider: "none" } });
    expect(resolveJudgeProvider()).toBeNull();
  });
});

describe("resolveImplementRuntime (spec 0033, ADR-026)", () => {
  it("routes to the seat when implementSeat is set and no agent model is pinned", () => {
    expect(
      resolveImplementRuntime({
        agentRuntime: "claude-code",
        implementSeat: "gemini-cli",
      }),
    ).toBe("gemini-cli");
  });

  it("keeps the agent's runtime when a per-agent model is pinned (model wins)", () => {
    expect(
      resolveImplementRuntime({
        agentRuntime: "claude-code",
        agentModel: "opus",
        implementSeat: "gemini-cli",
      }),
    ).toBe("claude-code");
  });

  it("honors an explicit caller pin over the seat", () => {
    expect(
      resolveImplementRuntime({
        requestedRuntimeId: "antigravity-cli",
        agentRuntime: "claude-code",
        implementSeat: "gemini-cli",
      }),
    ).toBe("antigravity-cli");
  });

  it("returns the base runtime unchanged when the seat is unset (regression)", () => {
    expect(
      resolveImplementRuntime({
        agentRuntime: "claude-code",
        projectDefault: "gemini-cli",
      }),
    ).toBe("claude-code");
    // Falls through to the project default when the agent has no runtime.
    expect(
      resolveImplementRuntime({
        agentRuntime: "",
        projectDefault: "gemini-cli",
      }),
    ).toBe("gemini-cli");
  });
});
