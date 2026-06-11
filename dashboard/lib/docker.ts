// dashboard/lib/docker.ts
// Thin docker CLI wrapper (spec 0021, ADR-017). CLI only — no socket library:
// the docker binary abstracts the Windows named-pipe transport, and spawnSync
// matches the repo's existing exec patterns. Mutations are allowlist-gated.
import { spawnSync } from "node:child_process";
import { getSettings } from "@/lib/settings";

export interface DockerStack {
  name: string;
  status: string;
  configFiles: string;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  composeProject: string | null;
  ports: string;
}

export type StackAction = "start" | "stop" | "restart";

const PROJECT_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;

type ExecFn = (args: string[]) => { ok: boolean; stdout: string; stderr: string };

function realExec(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const r = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: 30_000,
    shell: process.platform === "win32",
    maxBuffer: 8 * 1024 * 1024,
  });
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: r.error?.message ?? r.stderr ?? "" };
}

let exec: ExecFn = realExec;

/** Test seam: inject a fake exec; returns a restore function. */
export function setDockerExecForTesting(fn: ExecFn | null): void {
  exec = fn ?? realExec;
}

export function dockerAvailable(): { cli: boolean; daemon: boolean; version?: string } {
  const v = exec(["--version"]);
  if (!v.ok) return { cli: false, daemon: false };
  const version = v.stdout.match(/(\d+\.\d+\.\d+)/)?.[1];
  const info = exec(["info", "--format", "{{json .ServerVersion}}"]);
  return { cli: true, daemon: info.ok, version };
}

/** Parse either a JSON array or NDJSON (one object per line) — CLI versions vary. */
function parseJsonish(text: string): Array<Record<string, unknown>> {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [parsed as Record<string, unknown>];
  } catch {
    const out: Array<Record<string, unknown>> = [];
    for (const line of trimmed.split("\n")) {
      try {
        out.push(JSON.parse(line) as Record<string, unknown>);
      } catch {
        // skip malformed lines
      }
    }
    return out;
  }
}

export function listStacks(): DockerStack[] {
  const r = exec(["compose", "ls", "--all", "--format", "json"]);
  if (!r.ok) return [];
  return parseJsonish(r.stdout).map((s) => ({
    name: String(s.Name ?? ""),
    status: String(s.Status ?? ""),
    configFiles: String(s.ConfigFiles ?? ""),
  }));
}

export function listContainers(): DockerContainer[] {
  let r = exec(["ps", "--all", "--format", "json"]);
  if (!r.ok) r = exec(["ps", "--all", "--format", "{{json .}}"]);
  if (!r.ok) return [];
  return parseJsonish(r.stdout).map((c) => {
    const labels = String(c.Labels ?? "");
    const composeProject = labels.match(/com\.docker\.compose\.project=([^,]+)/)?.[1] ?? null;
    return {
      id: String(c.ID ?? ""),
      name: String(c.Names ?? c.Name ?? ""),
      image: String(c.Image ?? ""),
      state: String(c.State ?? ""),
      status: String(c.Status ?? ""),
      composeProject,
      ports: String(c.Ports ?? ""),
    };
  });
}

export function assertAllowlisted(project: string): void {
  if (!PROJECT_NAME_RE.test(project)) throw new Error(`invalid compose project name: ${project}`);
  const allowlist = getSettings().docker.allowlist;
  if (!allowlist.includes(project)) {
    throw new Error(`compose project "${project}" is not on the allowlist (settings.docker.allowlist)`);
  }
}

export function stackAction(action: StackAction, project: string): { ok: boolean; output: string } {
  assertAllowlisted(project);
  const r = exec(["compose", "-p", project, action]);
  return { ok: r.ok, output: r.ok ? r.stdout : r.stderr };
}

export function containerLogs(id: string, tail = 400): string {
  if (!/^[a-f0-9]{4,64}$/i.test(id)) throw new Error(`invalid container id: ${id}`);
  const r = exec(["logs", "--tail", String(tail), id]);
  // ANSI sequences stripped for the <pre> viewer.
  // eslint-disable-next-line no-control-regex
  return `${r.stdout}${r.stderr}`.replace(/\[[0-9;]*m/g, "");
}
