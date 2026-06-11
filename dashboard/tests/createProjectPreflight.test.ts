import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPreflight } from "@/lib/createProject/preflight";
import type { ConnectionStatus } from "@/lib/connections";

function status(id: string, s: ConnectionStatus["status"]): ConnectionStatus {
  return { id, label: id, status: s, detail: "", setup: [] };
}

function tmpDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "preflight-"));
  return {
    workspaceRoot: path.join(root, "workspace"),
    vaultProjectsDir: path.join(root, "vault", "projects"),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

describe("runPreflight", () => {
  it("passes with claude+gh connected and writable dirs", async () => {
    const dirs = tmpDirs();
    fs.mkdirSync(dirs.workspaceRoot, { recursive: true });
    const r = await runPreflight(
      { wantRepo: true, workspaceRoot: dirs.workspaceRoot, vaultProjectsDir: dirs.vaultProjectsDir },
      {
        statuses: async () => [status("claude", "connected"), status("github", "connected")],
        gitConfigEmail: () => "tj@example.com",
      }
    );
    expect(r.ok).toBe(true);
    expect(r.failures).toEqual([]);
    expect(r.warnings).toEqual([]);
    dirs.cleanup();
  });

  it("fails when gh is not configured and a repo is wanted", async () => {
    const dirs = tmpDirs();
    fs.mkdirSync(dirs.workspaceRoot, { recursive: true });
    const r = await runPreflight(
      { wantRepo: true, workspaceRoot: dirs.workspaceRoot, vaultProjectsDir: dirs.vaultProjectsDir },
      {
        statuses: async () => [status("claude", "connected"), status("github", "not-configured")],
        gitConfigEmail: () => "tj@example.com",
      }
    );
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.includes("gh"))).toBe(true);
    dirs.cleanup();
  });

  it("ignores gh for local-only", async () => {
    const dirs = tmpDirs();
    fs.mkdirSync(dirs.workspaceRoot, { recursive: true });
    const r = await runPreflight(
      { wantRepo: false, workspaceRoot: dirs.workspaceRoot, vaultProjectsDir: dirs.vaultProjectsDir },
      {
        statuses: async () => [status("claude", "connected"), status("github", "not-configured")],
        gitConfigEmail: () => "tj@example.com",
      }
    );
    expect(r.ok).toBe(true);
    dirs.cleanup();
  });

  it("fails when claude is unavailable", async () => {
    const dirs = tmpDirs();
    fs.mkdirSync(dirs.workspaceRoot, { recursive: true });
    const r = await runPreflight(
      { wantRepo: false, workspaceRoot: dirs.workspaceRoot, vaultProjectsDir: dirs.vaultProjectsDir },
      {
        statuses: async () => [status("claude", "unavailable")],
        gitConfigEmail: () => "tj@example.com",
      }
    );
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.includes("claude"))).toBe(true);
    dirs.cleanup();
  });

  it("warns (not fails) when git user.email is empty", async () => {
    const dirs = tmpDirs();
    fs.mkdirSync(dirs.workspaceRoot, { recursive: true });
    const r = await runPreflight(
      { wantRepo: false, workspaceRoot: dirs.workspaceRoot, vaultProjectsDir: dirs.vaultProjectsDir },
      {
        statuses: async () => [status("claude", "connected")],
        gitConfigEmail: () => "",
      }
    );
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("user.email"))).toBe(true);
    dirs.cleanup();
  });
});
