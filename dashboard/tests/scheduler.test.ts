import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadAutomations, dueAutomations, lastScheduledFire, type AutomationSpec } from "@/lib/scheduler";

function spec(overrides: Partial<AutomationSpec>): AutomationSpec {
  return {
    file: "test-skill-daily.md",
    skill: "test-skill",
    cron: "0 9 * * *",
    project: "sample",
    agent: undefined,
    inputs: [],
    body: "",
    cronError: null,
    ...overrides,
  };
}

describe("lastScheduledFire", () => {
  it("returns the most recent fire at or before now", () => {
    // cron-parser evaluates in local time; build the date in local time too.
    const now = new Date(2026, 5, 10, 10, 30);
    const t = lastScheduledFire("0 10 * * *", now);
    expect(t).not.toBeNull();
    const fired = new Date(t!);
    expect(fired.getHours()).toBe(10);
    expect(now.getTime() - t!).toBeLessThan(24 * 60 * 60 * 1000);
    expect(t!).toBeLessThanOrEqual(now.getTime());
  });

  it("returns null for invalid cron", () => {
    expect(lastScheduledFire("not a cron", new Date())).toBeNull();
  });
});

describe("dueAutomations", () => {
  const now = new Date("2026-06-10T09:05:00");

  it("fires a spec whose schedule passed since the last recorded run", () => {
    const due = dueAutomations([spec({})], { now, lastRunByFile: new Map() });
    expect(due).toHaveLength(1);
    expect(due[0].spec.file).toBe("test-skill-daily.md");
  });

  it("does not refire when last run is at or after the scheduled time", () => {
    const scheduled = lastScheduledFire("0 9 * * *", now)!;
    const due = dueAutomations([spec({})], {
      now,
      lastRunByFile: new Map([["test-skill-daily.md", scheduled]]),
    });
    expect(due).toHaveLength(0);
  });

  it("skips fires older than the missed-run window (laptop was asleep)", () => {
    const due = dueAutomations([spec({})], {
      now,
      lastRunByFile: new Map(),
      missedWindowMs: 60_000,
    });
    expect(due).toHaveLength(0);
  });

  it("never fires specs without a project target or with a broken cron", () => {
    expect(dueAutomations([spec({ project: undefined })], { now, lastRunByFile: new Map() })).toHaveLength(0);
    expect(dueAutomations([spec({ cronError: "bad" })], { now, lastRunByFile: new Map() })).toHaveLength(0);
  });
});

describe("loadAutomations", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "automations-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("parses frontmatter including the optional project and agent keys", () => {
    fs.writeFileSync(
      path.join(dir, "test-skill-daily.md"),
      `---\nschedule: "*/5 * * * *"\nskill: test-skill\nproject: sample\nagent: health-watcher\ninputs: ["today"]\n---\n\nBody text.\n`
    );
    fs.writeFileSync(path.join(dir, "README.md"), "ignored");
    const specs = loadAutomations(dir);
    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({
      skill: "test-skill",
      project: "sample",
      agent: "health-watcher",
      inputs: ["today"],
      cronError: null,
    });
    expect(specs[0].body).toContain("Body text.");
  });

  it("records cron errors instead of throwing", () => {
    fs.writeFileSync(
      path.join(dir, "x-daily.md"),
      `---\nschedule: "nonsense"\nskill: x\n---\n`
    );
    const specs = loadAutomations(dir);
    expect(specs).toHaveLength(1);
    expect(specs[0].cronError).toBeTruthy();
  });
});
