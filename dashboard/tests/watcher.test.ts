import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { startWatcher, stopWatcher, getEventCount, resetWatcherForTesting } from "@/lib/watcher";

let WORK: string;

beforeEach(() => {
  WORK = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-watcher-"));
  resetWatcherForTesting();
});

afterEach(async () => {
  await stopWatcher();
  fs.rmSync(WORK, { recursive: true, force: true });
});

describe("watcher", () => {
  it("detects PROJECT.md additions under vault/projects", async () => {
    const projectsRoot = path.join(WORK, "vault", "projects");
    const agentsRoot = path.join(WORK, "agents");
    fs.mkdirSync(path.join(projectsRoot, "new-proj"), { recursive: true });
    fs.mkdirSync(agentsRoot, { recursive: true });

    await startWatcher({ projectsRoot, agentsRoot });

    fs.writeFileSync(path.join(projectsRoot, "new-proj", "PROJECT.md"), `---
name: New Proj
slug: new-proj
path: /tmp
created: 2026-01-01
---
body
`);

    await new Promise(r => setTimeout(r, 800));
    expect(getEventCount("project")).toBeGreaterThan(0);
  });

  it("detects agent file changes", async () => {
    fs.mkdirSync(path.join(WORK, "agents"), { recursive: true });
    fs.mkdirSync(path.join(WORK, "vault", "projects"), { recursive: true });
    await startWatcher({
      projectsRoot: path.join(WORK, "vault", "projects"),
      agentsRoot: path.join(WORK, "agents"),
    });

    fs.writeFileSync(path.join(WORK, "agents", "new-agent.md"), `---
name: a
slug: new-agent
runtime: claude-code
created: 2026-01-01
---
body
`);

    await new Promise(r => setTimeout(r, 800));
    expect(getEventCount("agent")).toBeGreaterThan(0);
  });
});
