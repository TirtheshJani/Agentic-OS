import "./helpers/repoRootStub";
import fs from "node:fs";
import { describe, it, expect, beforeEach } from "vitest";
import { SETTINGS_PATH } from "@/lib/paths";
import { getSettings, setSettings, resetSettingsForTesting } from "@/lib/settings";

// Each test starts from a clean slate: drop the persisted file (setSettings
// deep-merges onto whatever is on disk) and the in-memory cache. This mirrors
// the round-trip the settings page performs via PATCH /api/settings.
beforeEach(() => {
  fs.rmSync(SETTINGS_PATH, { force: true });
  resetSettingsForTesting();
});

describe("settings role-assignment round-trip (the layer the page persists through)", () => {
  it("persists a plan+validate mapping across a reload", () => {
    setSettings({ roleAssignment: { plan: "gemini-cli", validate: "claude-code" } });
    resetSettingsForTesting();
    expect(getSettings().roleAssignment).toEqual({ plan: "gemini-cli", validate: "claude-code" });
  });

  it("unset roles stay absent so default behavior is preserved", () => {
    setSettings({ roleAssignment: { implement: "claude-code" } });
    const stored = getSettings().roleAssignment;
    expect(stored.implement).toBe("claude-code");
    expect("plan" in stored).toBe(false);
    expect("validate" in stored).toBe(false);
  });

  it("the empty map is the default (every role unset keeps today's behavior)", () => {
    expect(getSettings().roleAssignment).toEqual({});
  });
});
