import "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { getSettings, setSettings, resetSettingsForTesting } from "@/lib/settings";
import { resolveRoleRuntime, runtimeToAnswerProvider } from "@/lib/runtime/roles";

beforeEach(() => resetSettingsForTesting());
afterEach(() => vi.restoreAllMocks());

describe("roleAssignment settings (default-off)", () => {
  it("defaults to an empty map", () => {
    expect(getSettings().roleAssignment).toEqual({});
  });

  it("an empty-patch round-trip leaves it {} (regression guard)", () => {
    const next = setSettings({});
    expect(next.roleAssignment).toEqual({});
    resetSettingsForTesting();
    expect(getSettings().roleAssignment).toEqual({});
  });

  it("deep-merges a partial role patch", () => {
    setSettings({ roleAssignment: { implement: "claude-code" } });
    const merged = setSettings({ roleAssignment: { plan: "gemini-cli" } });
    expect(merged.roleAssignment).toEqual({ plan: "gemini-cli", implement: "claude-code" });
  });
});

describe("resolveRoleRuntime", () => {
  it("returns null for an unmapped role (caller uses today's default)", () => {
    expect(resolveRoleRuntime("plan", { assignment: {} })).toBeNull();
  });

  it("resolves a mapped-and-available runtime", () => {
    const res = resolveRoleRuntime("implement", {
      assignment: { implement: "claude-code" },
      available: () => true,
    });
    expect(res).toEqual({ runtimeId: "claude-code", downgraded: false });
  });

  it("falls back to default and logs one downgrade line when the mapped runtime is unavailable", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const res = resolveRoleRuntime("validate", {
      assignment: { validate: "antigravity-cli" },
      available: () => false,
    });
    expect(res).toBeNull(); // non-failure: caller falls back to default
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("antigravity-cli");
    expect(spy.mock.calls[0][0]).toContain("validate");
  });
});

describe("runtimeToAnswerProvider", () => {
  it("maps claude-code to claude-cli", () => {
    expect(runtimeToAnswerProvider("claude-code")).toBe("claude-cli");
  });
  it("maps gemini-cli to gemini-cli", () => {
    expect(runtimeToAnswerProvider("gemini-cli")).toBe("gemini-cli");
  });
  it("returns null for antigravity-cli (no one-shot answer CLI)", () => {
    expect(runtimeToAnswerProvider("antigravity-cli")).toBeNull();
  });
  it("returns null for an unknown runtime id", () => {
    expect(runtimeToAnswerProvider("who-knows")).toBeNull();
  });
});
