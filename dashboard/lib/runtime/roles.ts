// dashboard/lib/runtime/roles.ts
// Role-to-runtime mapping (spec 0033, ADR-026). Default-off: an unset role
// resolves to null so callers keep today's default runtime selection. A mapped
// runtime that is unavailable downgrades to the default with one info log; this
// helper never throws and never fails a run.
import type { AnswerProviderId } from "@/lib/rag/answer/cliAnswer";
import { getRuntime } from "@/lib/runtime/registry";
import { getSettings } from "@/lib/settings";

export type Role = "plan" | "implement" | "validate";

/**
 * Bridge a runtime id to the one-shot RAG answer-provider id (ADR-026 R1).
 * Returns null for runtimes with no `-p` one-shot answer CLI (e.g. antigravity).
 */
export function runtimeToAnswerProvider(runtimeId: string): AnswerProviderId | null {
  switch (runtimeId) {
    case "claude-code":
      return "claude-cli";
    case "gemini-cli":
      return "gemini-cli";
    default:
      return null; // antigravity-cli: no one-shot -p answer CLI
  }
}

export interface RoleRuntimeResolution {
  /** The runtime id to spawn for this role. */
  runtimeId: string;
  /** True when the configured runtime was unavailable and this is the default fallback. */
  downgraded: boolean;
}

export interface ResolveRoleRuntimeOpts {
  /** Configured role-to-runtime map. Defaults to settings.roleAssignment. */
  assignment?: Partial<Record<Role, string>>;
  /** Availability predicate. Defaults to a registry presence check. */
  available?: (runtimeId: string) => boolean;
}

/**
 * Resolve a role to an available runtime.
 *
 * Returns null when the role is unmapped: the caller keeps today's default
 * runtime selection (byte-for-byte unchanged behavior). When mapped and the
 * runtime is available, returns it with `downgraded: false`. When mapped but
 * unavailable, emits one info-level downgrade line and returns null so the
 * caller falls back to its default. Never throws.
 */
export function resolveRoleRuntime(
  role: Role,
  opts: ResolveRoleRuntimeOpts = {},
): RoleRuntimeResolution | null {
  const assignment = opts.assignment ?? getSettings().roleAssignment;
  const requested = assignment[role];
  if (!requested) return null; // unset: caller uses today's default

  const isAvailable = opts.available ?? ((id: string) => getRuntime(id) !== null);
  if (isAvailable(requested)) {
    return { runtimeId: requested, downgraded: false };
  }

  console.info(
    `[roles] requested runtime ${requested} unavailable for role ${role}; falling back to default`,
  );
  return null;
}
