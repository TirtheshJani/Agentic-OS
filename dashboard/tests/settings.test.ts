import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { getSettings, setSettings, resetSettingsForTesting } from "@/lib/settings";

const TMP = path.join(os.tmpdir(), `agentic-os-test-${Date.now()}`);

beforeEach(() => {
  fs.mkdirSync(TMP, { recursive: true });
  process.env.AGENTIC_OS_STATE_DIR = TMP;
  resetSettingsForTesting();
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  delete process.env.AGENTIC_OS_STATE_DIR;
});

describe("settings", () => {
  it("returns defaults when settings.json does not exist", () => {
    const s = getSettings();
    expect(s.workspaceRoot).toMatch(/code$/);
    expect(s.concurrency.perProjectMax).toBe(3);
    expect(s.concurrency.globalMax).toBe(5);
  });

  it("persists changes to disk", () => {
    setSettings({ workspaceRoot: "/tmp/mycode" });
    const reloaded = getSettings();
    expect(reloaded.workspaceRoot).toBe("/tmp/mycode");
  });

  it("merges partial updates without losing other fields", () => {
    setSettings({ workspaceRoot: "/tmp/a" });
    setSettings({ concurrency: { perProjectMax: 10, globalMax: 20 } });
    const s = getSettings();
    expect(s.workspaceRoot).toBe("/tmp/a");
    expect(s.concurrency.perProjectMax).toBe(10);
  });

  it("defaults all feature flags to true", () => {
    const s = getSettings();
    expect(Object.values(s.features).every(Boolean)).toBe(true);
    expect(s.features.docker).toBe(true);
  });

  it("merges feature flag patches without wiping sibling flags", () => {
    setSettings({ features: { ...getSettings().features, docker: false } });
    setSettings({ workspaceRoot: "/tmp/b" });
    const s = getSettings();
    expect(s.features.docker).toBe(false);
    expect(s.features.notes).toBe(true);
  });

  it("defaults the evals block", () => {
    const s = getSettings();
    expect(s.evals.judgeProvider).toBe("inherit");
    expect(s.evals.autoGradeEnabled).toBe(false);
    expect(s.evals.batchLimit).toBe(10);
    expect(s.evals.reviseThreshold).toBe(70);
  });

  it("persists an evals patch without wiping sibling evals fields", () => {
    setSettings({ evals: { ...getSettings().evals, autoGradeEnabled: true } });
    setSettings({ workspaceRoot: "/tmp/e" });
    const s = getSettings();
    expect(s.evals.autoGradeEnabled).toBe(true);
    expect(s.evals.batchLimit).toBe(10);
    expect(s.evals.judgeProvider).toBe("inherit");
    expect(s.evals.reviseThreshold).toBe(70);
    expect(s.workspaceRoot).toBe("/tmp/e");
  });

  it("persists a reviseThreshold patch and survives an unrelated update", () => {
    setSettings({ evals: { ...getSettings().evals, reviseThreshold: 55 } });
    setSettings({ workspaceRoot: "/tmp/rt" });
    const s = getSettings();
    expect(s.evals.reviseThreshold).toBe(55);
    expect(s.evals.autoGradeEnabled).toBe(false);
    expect(s.workspaceRoot).toBe("/tmp/rt");
  });
});
