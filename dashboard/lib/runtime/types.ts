import type * as pty from "node-pty";

export interface RuntimeAvailability {
  available: boolean;
  version: string | null;
  error?: string;
}

export interface SpawnOpts {
  worktreePath: string;
  initialPrompt: string;
  runId: number;
  issueId: number;
  projectSlug: string;
  /** Model passed to the CLI (--model / -m). Absent = runtime default. */
  model?: string;
  cols?: number;
  rows?: number;
}

export interface SpawnedRun {
  pty: pty.IPty;
  /** Subscribe to session_id resolution. Fires at most once per run. If session_id has already resolved when you subscribe, the callback fires immediately with the cached value. */
  onSessionId: (cb: (sid: string) => void) => void;
  /** Inject a session_id from outside (e.g., the SessionStart hook callback). Idempotent: second and later calls are no-ops. Stops any internal jsonl watch. */
  notifySessionId: (sid: string) => void;
  /** Kill the PTY and release any background watchers. Idempotent. */
  cleanup: () => Promise<void>;
}

export interface RuntimeCapabilities {
  /** Session can be re-attached via formatResumeCommand. */
  sessionResume: boolean;
  /** Emits a stable session ID we can capture (via hook, file watch, or self-assignment). */
  sessionIdCapture: boolean;
  /** Supports Claude Code-style hook events (SessionStart etc.). */
  hooks: boolean;
  /** Exposes parseable usage data for cost computation. */
  transcriptCostParsing: boolean;
  /** Can be opened in an external terminal mid-run via formatResumeCommand. */
  externalTerminalEscape: boolean;
}

export interface Runtime {
  /** Stable identifier, e.g. "claude-code". Matches `runtime-default` and `runtime` frontmatter values. */
  id: string;
  displayName: string;
  /** Static declaration of what this runtime supports. The UI consults these to hide or degrade features; each runtime's spawn flow owns its own gating. */
  capabilities: RuntimeCapabilities;
  /** Known model choices for the agent editor dropdown. The schema field is an open string, so values outside this list still work. */
  models?: ReadonlyArray<{ id: string; label: string }>;
  /** Returns availability + version. Used by the dashboard to show "claude-code 0.5.3" etc. */
  detect(): Promise<RuntimeAvailability>;
  /** Spawn a session in the given worktree and arrange for the initial prompt to be delivered. */
  spawn(opts: SpawnOpts): Promise<SpawnedRun>;
  /** Build the command an external terminal should run to resume the session. */
  formatResumeCommand(sessionId: string): string;
}

export class ConcurrencyCapError extends Error {
  constructor(public readonly scope: "project" | "global", public readonly cap: number, public readonly active: number) {
    super(`At ${scope} concurrency cap: ${active}/${cap}`);
    this.name = "ConcurrencyCapError";
  }
}
