// dashboard/lib/evals/behavioral.ts
// Behavioral validator harness (spec 0032 / ADR-025). Drives a live copy of the
// app to check `(e2e)`-marked acceptance assertions, one at a time, through an
// injectable driver. The harness owns the control flow (launch, per-assertion
// timeout, teardown) and is the tested surface; the default PlaywrightDriver is
// a thin, best-effort shell-out that CI never runs.
//
// Infra-failure posture mirrors the LLM judge: launch and per-check errors
// resolve to `inconclusive`, never `fail`, so flaky infrastructure does not
// score as agent failure. The harness never throws past its own boundary.
import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface BehavioralResult {
  assertion: string;
  status: "pass" | "fail" | "inconclusive";
  reason: string;
  screenshotPath?: string;
}

/** Injection seam: the harness drives the app through these three calls only. */
export interface BehavioralDriver {
  launch(worktreePath: string, port: number): Promise<void>;
  check(assertion: string, port: number): Promise<Omit<BehavioralResult, "assertion">>;
  close(): Promise<void>;
}

export interface BehavioralOpts {
  /** Defaults to a PlaywrightDriver that shells out to playwright-skill/run.js. */
  driver?: BehavioralDriver;
  /** Clock seam; defaults to Date.now. Tests inject a fake to trip the timeout. */
  now?: () => number;
  /** Hard cap across all assertions. Default 120_000 ms. */
  timeoutMs?: number;
  /** Port for the app under test. Default 0 (OS-assigned by the driver). */
  port?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const PLAYWRIGHT_RUN_JS = path.join(
  os.homedir(),
  ".claude",
  "skills",
  "playwright-skill",
  "run.js"
);

function inconclusive(assertion: string, reason: string): BehavioralResult {
  return { assertion, status: "inconclusive", reason };
}

/**
 * Run each `(e2e)` assertion against a live app via `opts.driver`.
 *
 * Control flow:
 *  - `driver.launch` failure marks every assertion `inconclusive` and returns.
 *  - Before each `check`, an elapsed-time check past `timeoutMs` marks this and
 *    every remaining assertion `inconclusive` and stops.
 *  - A single `check` that throws yields `inconclusive` for that assertion only.
 *  - `driver.close` always runs in a `finally`.
 * The harness never throws past its boundary.
 */
export async function runBehavioralAssertions(
  worktreePath: string,
  assertions: string[],
  opts: BehavioralOpts = {}
): Promise<BehavioralResult[]> {
  const driver = opts.driver ?? new PlaywrightDriver();
  const now = opts.now ?? Date.now;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const port = opts.port ?? 0;

  const start = now();
  const results: BehavioralResult[] = [];

  try {
    try {
      await driver.launch(worktreePath, port);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return assertions.map((a) => inconclusive(a, `behavioral launch failed: ${msg}`));
    }

    let timedOut = false;
    for (const assertion of assertions) {
      if (timedOut || now() - start > timeoutMs) {
        timedOut = true;
        results.push(inconclusive(assertion, `behavioral timeout after ${timeoutMs}ms`));
        continue;
      }
      try {
        const outcome = await driver.check(assertion, port);
        results.push({ assertion, ...outcome });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push(inconclusive(assertion, `behavioral check error: ${msg}`));
      }
    }
    return results;
  } finally {
    try {
      await driver.close();
    } catch {
      // Teardown is best-effort; a failed close must not mask results.
    }
  }
}

/**
 * Default driver: spawns `npm run dev` against the worktree on an ephemeral
 * port, warm-up-polls `/api/runtimes`, and runs Playwright scripts through the
 * vendored playwright-skill. Best-effort; CI injects a FakeDriver instead.
 */
export class PlaywrightDriver implements BehavioralDriver {
  private server: ReturnType<typeof spawn> | null = null;
  private stateDir: string | null = null;

  async launch(worktreePath: string, port: number): Promise<void> {
    this.stateDir = mkdtempSync(path.join(os.tmpdir(), "agentic-behavioral-"));
    this.server = spawn("npm", ["run", "dev"], {
      cwd: worktreePath,
      env: {
        ...process.env,
        PORT: String(port),
        AGENTIC_OS_REPO_ROOT: worktreePath,
        AGENTIC_OS_STATE_DIR: this.stateDir,
      },
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    await this.waitForReady(port);
  }

  async check(assertion: string, port: number): Promise<Omit<BehavioralResult, "assertion">> {
    const dir = this.stateDir ?? os.tmpdir();
    const screenshotPath = path.join(dir, `shot-${Date.now()}.png`);
    const scriptPath = path.join(dir, `pw-${Date.now()}.js`);
    writeFileSync(scriptPath, this.script(assertion, port, screenshotPath), "utf8");
    try {
      const stdout = await this.run(scriptPath);
      const status: BehavioralResult["status"] = /\bPASS\b/.test(stdout)
        ? "pass"
        : /\bFAIL\b/.test(stdout)
          ? "fail"
          : "inconclusive";
      let shot: string | undefined;
      try {
        readFileSync(screenshotPath);
        shot = screenshotPath;
      } catch {
        shot = undefined;
      }
      return { status, reason: stdout.trim().slice(0, 500), screenshotPath: shot };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: "inconclusive", reason: `playwright run failed: ${msg}` };
    }
  }

  async close(): Promise<void> {
    if (this.server && !this.server.killed) this.server.kill();
    this.server = null;
    if (this.stateDir) {
      try {
        rmSync(this.stateDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
      this.stateDir = null;
    }
  }

  private script(assertion: string, port: number, screenshotPath: string): string {
    const url = JSON.stringify(`http://localhost:${port}/`);
    const shot = JSON.stringify(screenshotPath);
    const label = JSON.stringify(assertion);
    return [
      `await page.goto(${url}, { waitUntil: "networkidle" });`,
      `await page.screenshot({ path: ${shot} });`,
      `console.log("checked assertion:", ${label});`,
      `console.log("INCONCLUSIVE: default driver does not auto-verify; review screenshot");`,
    ].join("\n");
  }

  private run(scriptPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile("node", [PLAYWRIGHT_RUN_JS, scriptPath], (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });
  }

  private async waitForReady(port: number): Promise<void> {
    const url = `http://localhost:${port}/api/runtimes`;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(url);
        if (res.status === 200) return;
      } catch {
        // server not up yet
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("dev server did not become ready within 60s");
  }
}
