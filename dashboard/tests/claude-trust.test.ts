import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { preTrustWorktree } from "@/lib/runtime/claude-code";

// preTrustWorktree writes the folder-trust flag into ~/.claude.json so claude's
// one-time "Do you trust this folder?" dialog does not swallow the injected
// prompt (--dangerously-skip-permissions does not cover folder trust). These
// tests point os.homedir() at a temp dir via USERPROFILE/HOME.

let HOME: string;
let prevUserProfile: string | undefined;
let prevHome: string | undefined;

beforeEach(() => {
  HOME = fs.mkdtempSync(path.join(os.tmpdir(), "claude-home-"));
  prevUserProfile = process.env.USERPROFILE;
  prevHome = process.env.HOME;
  process.env.USERPROFILE = HOME;
  process.env.HOME = HOME;
});

afterEach(() => {
  if (prevUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevUserProfile;
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  fs.rmSync(HOME, { recursive: true, force: true });
});

function readConfig() {
  return JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude.json"), "utf8"));
}

describe("preTrustWorktree", () => {
  it("creates ~/.claude.json with the trust flag when none exists", () => {
    preTrustWorktree("C:\\Users\\x\\repo\\.worktrees\\issue-1");
    const cfg = readConfig();
    // keys are stored with forward slashes even on Windows
    expect(cfg.projects["C:/Users/x/repo/.worktrees/issue-1"].hasTrustDialogAccepted).toBe(true);
  });

  it("merges into an existing config without dropping other projects", () => {
    const p = path.join(os.homedir(), ".claude.json");
    fs.writeFileSync(p, JSON.stringify({ numStartups: 7, projects: { "C:/other": { hasTrustDialogAccepted: true, allowedTools: ["x"] } } }));
    preTrustWorktree("/home/u/wt/issue-2");
    const cfg = readConfig();
    expect(cfg.numStartups).toBe(7); // unrelated top-level keys preserved
    expect(cfg.projects["C:/other"].allowedTools).toEqual(["x"]); // other projects preserved
    expect(cfg.projects["/home/u/wt/issue-2"].hasTrustDialogAccepted).toBe(true);
  });

  it("preserves existing fields on the same project entry", () => {
    const p = path.join(os.homedir(), ".claude.json");
    const key = "C:/Users/x/repo/.worktrees/issue-3";
    fs.writeFileSync(p, JSON.stringify({ projects: { [key]: { allowedTools: ["Read"], hasTrustDialogAccepted: false } } }));
    preTrustWorktree("C:\\Users\\x\\repo\\.worktrees\\issue-3");
    const cfg = readConfig();
    expect(cfg.projects[key].hasTrustDialogAccepted).toBe(true); // flipped on
    expect(cfg.projects[key].allowedTools).toEqual(["Read"]); // kept
  });

  it("does not throw when the config file is malformed", () => {
    fs.writeFileSync(path.join(os.homedir(), ".claude.json"), "{ not json");
    expect(() => preTrustWorktree("C:\\Users\\x\\repo\\.worktrees\\issue-4")).not.toThrow();
  });
});
