import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { injectPrompt, type InjectablePty } from "@/lib/runtime/promptInjector";

function fakeTerm() {
  const writes: string[] = [];
  let dataCb: ((d: string) => void) | null = null;
  let disposed = false;
  const term: InjectablePty = {
    onData(cb) {
      dataCb = cb;
      return {
        dispose() {
          disposed = true;
          dataCb = null;
        },
      };
    },
    write(d) {
      writes.push(d);
    },
  };
  return {
    term,
    writes,
    emit(d: string) {
      dataCb?.(d);
    },
    get disposed() {
      return disposed;
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("injectPrompt", () => {
  it("no-ops on an empty/whitespace body and writes nothing", () => {
    const f = fakeTerm();
    injectPrompt(f.term, "   \n  \t ", { settleMs: 100, maxWaitMs: 1000 });
    vi.advanceTimersByTime(5000);
    expect(f.writes).toEqual([]);
  });

  it("waits for output, then types the prompt once the TUI goes quiet (settle)", () => {
    const f = fakeTerm();
    injectPrompt(f.term, "do the task", {
      settleMs: 200,
      maxWaitMs: 5000,
      submitDelayMs: 50,
      resubmitMs: 0,
    });
    // No output yet -> nothing typed even after a while.
    vi.advanceTimersByTime(1000);
    expect(f.writes).toEqual([]);
    // TUI renders, then we wait for it to settle.
    f.emit("welcome to the TUI");
    vi.advanceTimersByTime(199);
    expect(f.writes).toEqual([]); // not settled yet
    vi.advanceTimersByTime(1); // settleMs elapsed -> type body
    expect(f.writes).toEqual(["do the task"]);
    vi.advanceTimersByTime(50); // submitDelay -> Enter as a separate write
    expect(f.writes).toEqual(["do the task", "\r"]);
  });

  it("resets the settle timer on each chunk (waits for true quiet)", () => {
    const f = fakeTerm();
    injectPrompt(f.term, "go", { settleMs: 200, maxWaitMs: 10000, submitDelayMs: 10, resubmitMs: 0 });
    f.emit("a");
    vi.advanceTimersByTime(150);
    f.emit("b"); // resets the settle window
    vi.advanceTimersByTime(150);
    expect(f.writes).toEqual([]); // still inside settle after the last chunk
    vi.advanceTimersByTime(50);
    expect(f.writes[0]).toBe("go");
  });

  it("types anyway at maxWaitMs even if output never settles (backstop)", () => {
    const f = fakeTerm();
    injectPrompt(f.term, "fallback", { settleMs: 10000, maxWaitMs: 1000, submitDelayMs: 10, resubmitMs: 0 });
    // Constant chatter keeps resetting the settle timer; the backstop must still fire.
    for (let i = 0; i < 20; i++) {
      f.emit("x");
      vi.advanceTimersByTime(40);
    }
    vi.advanceTimersByTime(300);
    expect(f.writes).toContain("fallback");
  });

  it("collapses whitespace/newlines into single spaces (one logical input line)", () => {
    const f = fakeTerm();
    injectPrompt(f.term, "line one\nline two\t\tend", {
      settleMs: 50,
      maxWaitMs: 1000,
      submitDelayMs: 5,
      resubmitMs: 0,
    });
    f.emit("ready");
    vi.advanceTimersByTime(60);
    expect(f.writes[0]).toBe("line one line two end");
  });

  it("sends a blind Enter early when blindEnterMs is set", () => {
    const f = fakeTerm();
    injectPrompt(f.term, "task", { blindEnterMs: 100, settleMs: 10000, maxWaitMs: 100000 });
    vi.advanceTimersByTime(100);
    expect(f.writes).toEqual(["\r"]); // blind Enter fires before any prompt typing
  });

  it("resends Enter once when resubmitMs > 0", () => {
    const f = fakeTerm();
    injectPrompt(f.term, "task", { settleMs: 50, maxWaitMs: 1000, submitDelayMs: 20, resubmitMs: 30 });
    f.emit("ready");
    vi.advanceTimersByTime(50); // settle -> body
    vi.advanceTimersByTime(20); // first Enter
    vi.advanceTimersByTime(30); // resubmit Enter
    expect(f.writes).toEqual(["task", "\r", "\r"]);
  });

  it("disposing cancels pending timers and the data listener (no writes after)", () => {
    const f = fakeTerm();
    const dispose = injectPrompt(f.term, "task", { settleMs: 100, maxWaitMs: 1000 });
    dispose();
    expect(f.disposed).toBe(true);
    f.emit("ready");
    vi.advanceTimersByTime(5000);
    expect(f.writes).toEqual([]);
  });

  it("fires exactly once (a later backstop does not double-type)", () => {
    const f = fakeTerm();
    injectPrompt(f.term, "once", { settleMs: 50, maxWaitMs: 200, submitDelayMs: 10, resubmitMs: 0 });
    f.emit("ready");
    vi.advanceTimersByTime(60); // settle fires
    vi.advanceTimersByTime(500); // backstop would have fired by now
    expect(f.writes.filter((w) => w === "once")).toHaveLength(1);
  });
});
