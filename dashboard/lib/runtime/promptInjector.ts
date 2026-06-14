/** Minimal slice of node-pty's IPty that prompt injection needs (so it can be
 * unit-tested with a fake terminal). */
export interface InjectablePty {
  onData(cb: (data: string) => void): { dispose: () => void };
  write(data: string): void;
}

export interface InjectOptions {
  /** ms of PTY silence (after the first output) before the TUI is "ready". */
  settleMs?: number;
  /** absolute cap: type the prompt anyway after this long, even if output never settles. */
  maxWaitMs?: number;
  /** gap between writing the body and the submitting Enter. */
  submitDelayMs?: number;
  /** send one blind Enter this early to dismiss a pre-prompt dialog (0 = off). */
  blindEnterMs?: number;
  /** resend Enter once this long after the first, in case it raced the TUI (0 = off). */
  resubmitMs?: number;
  log?: (msg: string) => void;
}

function num(v: string | undefined, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

/**
 * Deliver an initial prompt into an interactive CLI's PTY robustly.
 *
 * Why typed-into-PTY instead of argv: on Windows the CLI launches through
 * `cmd.exe /c` (see lib/runtime/launch.ts), which re-parses `& | < > ^ % "` and
 * would corrupt an arbitrary issue body. Typing into the PTY is binary-safe on
 * every platform.
 *
 * Why settle-based instead of a fixed delay: the previous code typed the prompt
 * after a hard-coded 5s. On a cold/slow machine the CLI's TUI was not ready yet,
 * so the keystrokes were dropped and the agent sat idle ("does nothing"). Here we
 * wait until the TUI has produced output and then been quiet for `settleMs`
 * (its initial render finished), with `maxWaitMs` as a backstop.
 *
 * Returns a disposer the caller invokes on cleanup to cancel pending timers.
 */
export function injectPrompt(
  term: InjectablePty,
  rawBody: string,
  opts: InjectOptions = {},
): () => void {
  // Collapse whitespace/newlines so the TUI keeps the prompt on one logical
  // input line (embedded \n keeps these TUIs in multi-line mode, so a trailing
  // Enter would not submit).
  const body = rawBody.replace(/\s+/g, " ").trim();
  if (!body) return () => {};

  const settleMs = opts.settleMs ?? num(process.env.AGENTIC_OS_PROMPT_SETTLE_MS, 800);
  const maxWaitMs = opts.maxWaitMs ?? num(process.env.AGENTIC_OS_PROMPT_MAXWAIT_MS, 8000);
  const submitDelayMs = opts.submitDelayMs ?? 250;
  const blindEnterMs = opts.blindEnterMs ?? 0;
  const resubmitMs = opts.resubmitMs ?? 600;
  const log = opts.log ?? (() => {});

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const after = (ms: number, fn: () => void) => {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    timers.add(t);
    return t;
  };
  const write = (d: string) => { try { term.write(d); } catch { /* PTY dead */ } };

  // Held in an object so `fire`/`dispose` (defined before the subscription) can
  // reach the disposable without a forward `let` reference.
  const sub: { current?: { dispose: () => void } } = {};
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let fired = false;

  function dispose() {
    for (const t of timers) clearTimeout(t);
    timers.clear();
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = undefined; }
    try { sub.current?.dispose(); } catch { /* ignore */ }
  }

  function fire() {
    if (fired) return;
    fired = true;
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = undefined; }
    try { sub.current?.dispose(); } catch { /* ignore */ }
    log(`typing prompt (${body.length} chars)`);
    write(body);
    // Enter as a SEPARATE delayed write: body + "\r" in one chunk is not reliably
    // registered as a discrete keypress by ConPTY-backed TUIs.
    after(submitDelayMs, () => write("\r"));
    if (resubmitMs > 0) after(submitDelayMs + resubmitMs, () => write("\r"));
  }

  if (blindEnterMs > 0) after(blindEnterMs, () => write("\r"));

  sub.current = term.onData(() => {
    if (fired) return;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(fire, settleMs);
  });
  after(maxWaitMs, fire); // backstop if the TUI never settles

  return dispose;
}
