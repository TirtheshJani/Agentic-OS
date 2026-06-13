import "./helpers/repoRootStub";
import { describe, it, expect } from "vitest";
import { parseContract } from "@/lib/evals/contract";
import {
  runBehavioralAssertions,
  type BehavioralDriver,
  type BehavioralResult,
} from "@/lib/evals/behavioral";

// A scriptable driver: each `check` consumes the next outcome (or runs a side
// effect, e.g. advancing a fake clock). Tracks whether `close` ran.
class FakeDriver implements BehavioralDriver {
  closed = false;
  launches = 0;
  checks: string[] = [];
  private outcomes: Array<Omit<BehavioralResult, "assertion"> | (() => Omit<BehavioralResult, "assertion">)>;
  private launchError?: Error;

  constructor(opts: {
    outcomes?: Array<Omit<BehavioralResult, "assertion"> | (() => Omit<BehavioralResult, "assertion">)>;
    launchError?: Error;
  } = {}) {
    this.outcomes = opts.outcomes ?? [];
    this.launchError = opts.launchError;
  }

  async launch(): Promise<void> {
    this.launches += 1;
    if (this.launchError) throw this.launchError;
  }

  async check(assertion: string): Promise<Omit<BehavioralResult, "assertion">> {
    this.checks.push(assertion);
    const next = this.outcomes.shift() ?? { status: "inconclusive" as const, reason: "no outcome queued" };
    return typeof next === "function" ? next() : next;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

describe("parseContract e2e tagging", () => {
  it("tags an (e2e)-marked assertion as behavioral and strips the marker", () => {
    const body = [
      "## Acceptance contract",
      "- [ ] The /issues board renders the new card (e2e)",
      "- [ ] Internal helper returns the right shape",
    ].join("\n");
    const a = parseContract(body);
    expect(a).toHaveLength(2);

    const behavioral = a[0];
    expect(behavioral.e2e).toBe(true);
    expect(behavioral.text).toBe("The /issues board renders the new card");
    expect(behavioral.text).not.toContain("(e2e)");

    const judgeOnly = a[1];
    expect(judgeOnly.e2e).toBe(false);
    expect(judgeOnly.text).toBe("Internal helper returns the right shape");
  });
});

describe("runBehavioralAssertions", () => {
  it("emits pass with the assertion text preserved", async () => {
    const driver = new FakeDriver({ outcomes: [{ status: "pass", reason: "ok" }] });
    const results = await runBehavioralAssertions("/tmp/wt", ["the page loads"], { driver });
    expect(results).toEqual([{ assertion: "the page loads", status: "pass", reason: "ok" }]);
    expect(driver.closed).toBe(true);
  });

  it("emits fail and inconclusive as returned by the driver", async () => {
    const driver = new FakeDriver({
      outcomes: [
        { status: "fail", reason: "button missing" },
        { status: "inconclusive", reason: "could not tell" },
      ],
    });
    const results = await runBehavioralAssertions("/tmp/wt", ["a", "b"], { driver });
    expect(results.map((r) => r.status)).toEqual(["fail", "inconclusive"]);
    expect(results[0].reason).toBe("button missing");
    expect(driver.closed).toBe(true);
  });

  it("marks ALL assertions inconclusive when launch fails, without throwing", async () => {
    const driver = new FakeDriver({ launchError: new Error("port in use") });
    const promise = runBehavioralAssertions("/tmp/wt", ["a", "b"], { driver });
    await expect(promise).resolves.toHaveLength(2);
    const results = await promise;
    expect(results.every((r) => r.status === "inconclusive")).toBe(true);
    expect(results.every((r) => r.reason.includes("launch failed"))).toBe(true);
    expect(results.every((r) => r.reason.includes("port in use"))).toBe(true);
    expect(driver.checks).toHaveLength(0);
    expect(driver.closed).toBe(true);
  });

  it("treats a single check throw as inconclusive and continues", async () => {
    const driver = new FakeDriver({
      outcomes: [
        () => {
          throw new Error("driver blew up");
        },
        { status: "pass", reason: "ok" },
      ],
    });
    const results = await runBehavioralAssertions("/tmp/wt", ["a", "b"], { driver });
    expect(results[0].status).toBe("inconclusive");
    expect(results[0].reason).toContain("driver blew up");
    expect(results[1].status).toBe("pass");
    expect(driver.closed).toBe(true);
  });

  it("respects the timeout: assertions after the trip are inconclusive", async () => {
    let t = 0;
    const now = (): number => t;
    // First check advances the clock past the cap; the second is never run.
    const driver = new FakeDriver({
      outcomes: [
        () => {
          t = 50;
          return { status: "pass", reason: "ok" };
        },
        { status: "pass", reason: "should not run" },
      ],
    });
    const results = await runBehavioralAssertions("/tmp/wt", ["first", "second"], {
      driver,
      now,
      timeoutMs: 10,
    });
    expect(results[0].status).toBe("pass");
    expect(results[1].status).toBe("inconclusive");
    expect(results[1].reason).toContain("timeout");
    expect(driver.checks).toEqual(["first"]);
    expect(driver.closed).toBe(true);
  });
});
