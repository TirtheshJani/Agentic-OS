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

export interface Runtime {
  /** Stable identifier, e.g. "claude-code". Matches `runtime-default` and `runtime` frontmatter values. */
  id: string;
  displayName: string;
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
