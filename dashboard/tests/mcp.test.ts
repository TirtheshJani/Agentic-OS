import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeMcpTemplate, readMcpTemplate, listMcpTemplates, installWorktreeMcpConfig } from "@/lib/mcp";

afterAll(() => {
  cleanupTestRepoRoot();
});

let worktree: string;

beforeEach(() => {
  fs.rmSync(path.join(TEST_REPO_ROOT, ".agentic-os", "mcp"), { recursive: true, force: true });
  worktree = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-wt-"));
});

describe("mcp templates", () => {
  it("round-trips write/read/list", () => {
    writeMcpTemplate("gmail", {
      "gmail-personal": { command: "npx", args: ["@gongrzhe/server-gmail-autoauth-mcp"] },
      "gmail-work": { command: "npx", args: ["@gongrzhe/server-gmail-autoauth-mcp"] },
    });
    expect(readMcpTemplate("gmail")).toMatchObject({ "gmail-personal": { command: "npx" } });
    expect(listMcpTemplates()).toEqual([{ name: "gmail", servers: ["gmail-personal", "gmail-work"] }]);
    expect(readMcpTemplate("missing")).toBeNull();
  });

  it("rejects bad template names", () => {
    expect(() => writeMcpTemplate("../evil", {})).toThrow(/invalid/);
  });
});

describe("installWorktreeMcpConfig", () => {
  it("writes .mcp.json and flips enableAllProjectMcpServers without clobbering hooks", () => {
    writeMcpTemplate("gmail", { "gmail-personal": { command: "npx" } });

    // Simulate the hook installer having written settings.local.json first.
    const settingsDir = path.join(worktree, ".claude");
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(
      path.join(settingsDir, "settings.local.json"),
      JSON.stringify({ hooks: { SessionStart: [{ hooks: [] }] } })
    );

    const servers = installWorktreeMcpConfig(worktree, ["gmail", "nonexistent"]);
    expect(servers).toEqual(["gmail-personal"]);

    const mcpJson = JSON.parse(fs.readFileSync(path.join(worktree, ".mcp.json"), "utf8"));
    expect(mcpJson.mcpServers["gmail-personal"].command).toBe("npx");

    const settings = JSON.parse(fs.readFileSync(path.join(settingsDir, "settings.local.json"), "utf8"));
    expect(settings.enableAllProjectMcpServers).toBe(true);
    expect(settings.hooks.SessionStart).toBeTruthy();
  });

  it("no-ops when no templates resolve", () => {
    expect(installWorktreeMcpConfig(worktree, ["missing"])).toEqual([]);
    expect(fs.existsSync(path.join(worktree, ".mcp.json"))).toBe(false);
  });
});
