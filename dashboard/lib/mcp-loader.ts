import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./paths";
import { loadProjects } from "./projects-loader";

export type McpSource = "claude-ai" | "user-config" | "project-config" | "repo-config";

export type McpServer = {
  name: string;
  source: McpSource;
  scope: string;
  transport: "stdio" | "http" | "sse" | "managed" | "unknown";
  toolCount: number | null;
};

const CLAUDE_AI_KNOWN: { name: string; tools: number }[] = [
  { name: "Canva", tools: 28 },
  { name: "Gmail", tools: 10 },
  { name: "Google_Calendar", tools: 8 },
  { name: "Google_Drive", tools: 8 },
  { name: "Notion", tools: 13 },
  { name: "Spotify", tools: 7 },
  { name: "WordPress_com", tools: 2 },
];

export function loadMcpServers(): McpServer[] {
  const out: McpServer[] = [];

  for (const c of CLAUDE_AI_KNOWN) {
    out.push({
      name: c.name,
      source: "claude-ai",
      scope: "cloud · claude.ai",
      transport: "managed",
      toolCount: c.tools,
    });
  }

  const userMcp = readUserConfigMcp();
  for (const s of userMcp) out.push(s);

  const repoMcp = readDotMcpJson(repoRoot, "repo-config", "repo root");
  for (const s of repoMcp) out.push(s);

  for (const p of loadProjects()) {
    if (!p.pathExists) continue;
    if (path.resolve(p.path).toLowerCase() === path.resolve(repoRoot).toLowerCase()) continue;
    const projMcp = readDotMcpJson(p.path, "project-config", `project · ${p.slug}`);
    for (const s of projMcp) out.push(s);
  }

  return out;
}

function readUserConfigMcp(): McpServer[] {
  const file = path.join(os.homedir(), ".claude.json");
  if (!fs.existsSync(file)) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
  const out: McpServer[] = [];
  const top = (raw as { mcpServers?: Record<string, McpEntry> }).mcpServers;
  if (top) {
    for (const [name, entry] of Object.entries(top)) {
      out.push(makeServer(name, entry, "user-config", "user · ~/.claude.json"));
    }
  }
  const projects = (raw as { projects?: Record<string, { mcpServers?: Record<string, McpEntry> }> }).projects;
  if (projects) {
    for (const [projPath, projCfg] of Object.entries(projects)) {
      if (!projCfg.mcpServers) continue;
      for (const [name, entry] of Object.entries(projCfg.mcpServers)) {
        out.push(makeServer(name, entry, "user-config", `user · per-project (${path.basename(projPath)})`));
      }
    }
  }
  return out;
}

function readDotMcpJson(dir: string, source: McpSource, scope: string): McpServer[] {
  const file = path.join(dir, ".mcp.json");
  if (!fs.existsSync(file)) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
  const servers = (raw as { mcpServers?: Record<string, McpEntry> }).mcpServers ?? {};
  return Object.entries(servers).map(([name, entry]) => makeServer(name, entry, source, scope));
}

type McpEntry = {
  command?: string;
  args?: string[];
  url?: string;
  type?: string;
};

function makeServer(name: string, entry: McpEntry, source: McpSource, scope: string): McpServer {
  const transport: McpServer["transport"] = entry.url
    ? entry.type === "sse"
      ? "sse"
      : "http"
    : entry.command
      ? "stdio"
      : "unknown";
  return { name, source, scope, transport, toolCount: null };
}

export type McpResolution =
  | { kind: "ready"; tmpConfigPath: string; source: McpSource; serverName: string }
  | { kind: "cloud-only"; serverName: string }
  | { kind: "not-found"; serverName: string };

export function resolveMcpForServer(name: string): McpResolution {
  if (CLAUDE_AI_KNOWN.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return { kind: "cloud-only", serverName: name };
  }

  const userFile = path.join(os.homedir(), ".claude.json");
  if (fs.existsSync(userFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(userFile, "utf8")) as {
        mcpServers?: Record<string, McpEntry>;
        projects?: Record<string, { mcpServers?: Record<string, McpEntry> }>;
      };
      const top = matchServer(raw.mcpServers, name);
      if (top) return materialize(top.key, top.value, "user-config");
      if (raw.projects) {
        for (const projCfg of Object.values(raw.projects)) {
          const hit = matchServer(projCfg?.mcpServers, name);
          if (hit) return materialize(hit.key, hit.value, "user-config");
        }
      }
    } catch {
      // fall through
    }
  }

  const repoFile = path.join(repoRoot, ".mcp.json");
  const repoHit = readMcpEntry(repoFile, name);
  if (repoHit) return materialize(repoHit.key, repoHit.value, "repo-config");

  for (const p of loadProjects()) {
    if (!p.pathExists) continue;
    if (path.resolve(p.path).toLowerCase() === path.resolve(repoRoot).toLowerCase()) continue;
    const projFile = path.join(p.path, ".mcp.json");
    const hit = readMcpEntry(projFile, name);
    if (hit) return materialize(hit.key, hit.value, "project-config");
  }

  return { kind: "not-found", serverName: name };
}

function matchServer(
  servers: Record<string, McpEntry> | undefined,
  name: string
): { key: string; value: McpEntry } | null {
  if (!servers) return null;
  for (const [key, value] of Object.entries(servers)) {
    if (key.toLowerCase() === name.toLowerCase()) return { key, value };
  }
  return null;
}

function readMcpEntry(file: string, name: string): { key: string; value: McpEntry } | null {
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      mcpServers?: Record<string, McpEntry>;
    };
    return matchServer(raw.mcpServers, name);
  } catch {
    return null;
  }
}

function materialize(serverName: string, entry: McpEntry, source: McpSource): McpResolution {
  const hash = crypto
    .createHash("sha1")
    .update(`${source}:${serverName}`)
    .digest("hex")
    .slice(0, 12);
  const file = path.join(os.tmpdir(), `agentic-os-mcp-${hash}.json`);
  const body = { mcpServers: { [serverName]: entry } };
  fs.writeFileSync(file, JSON.stringify(body, null, 2));
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // best-effort on Windows
  }
  return { kind: "ready", tmpConfigPath: file, source, serverName };
}
