import fs from "node:fs";
import path from "node:path";
import { STATE_DIR } from "@/lib/paths";

// MCP server configs hold OAuth paths and sometimes secrets, so templates
// live under the gitignored state dir, never in the vault (spec 0006's
// credentials decision).
const MCP_DIR = path.join(STATE_DIR, "mcp");

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

/** A template file maps server name -> MCP server config (command/args/env or url). */
export type McpTemplate = Record<string, Record<string, unknown>>;

function templatePath(name: string): string {
  if (!NAME_RE.test(name)) throw new Error(`invalid mcp template name: ${name}`);
  return path.join(MCP_DIR, `${name}.json`);
}

export function listMcpTemplates(): Array<{ name: string; servers: string[] }> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(MCP_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: Array<{ name: string; servers: string[] }> = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".json")) continue;
    const name = e.name.slice(0, -5);
    const tpl = readMcpTemplate(name);
    if (tpl) out.push({ name, servers: Object.keys(tpl) });
  }
  return out;
}

export function readMcpTemplate(name: string): McpTemplate | null {
  const fp = templatePath(name);
  if (!fs.existsSync(fp)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(fp, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as McpTemplate;
    return null;
  } catch {
    return null;
  }
}

export function writeMcpTemplate(name: string, config: McpTemplate): void {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("template must be an object mapping server name to config");
  }
  fs.mkdirSync(MCP_DIR, { recursive: true });
  fs.writeFileSync(templatePath(name), JSON.stringify(config, null, 2));
  console.log(`[mcp] wrote template ${name} (${Object.keys(config).length} server(s))`);
}

/** Merge the named templates into one server map. Missing templates are skipped. */
function mergeTemplates(templateNames: string[]): McpTemplate {
  const merged: McpTemplate = {};
  for (const name of templateNames) {
    const tpl = readMcpTemplate(name);
    if (!tpl) {
      console.warn(`[mcp] template not found, skipping: ${name}`);
      continue;
    }
    Object.assign(merged, tpl);
  }
  return merged;
}

/**
 * Merge the named templates into <worktree>/.mcp.json and flip
 * enableAllProjectMcpServers in .claude/settings.local.json so the agent is
 * not blocked on an approval prompt. Returns the installed server names.
 * Both writes merge with existing content (same pattern as hookInstaller).
 * Claude-code only; Gemini uses installGeminiWorktreeMcpConfig.
 */
export function installWorktreeMcpConfig(worktreePath: string, templateNames: string[]): string[] {
  const merged = mergeTemplates(templateNames);
  const servers = Object.keys(merged);
  if (servers.length === 0) return [];

  const mcpPath = path.join(worktreePath, ".mcp.json");
  let mcpJson: { mcpServers?: Record<string, unknown> } = {};
  if (fs.existsSync(mcpPath)) {
    try {
      mcpJson = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
    } catch {
      mcpJson = {};
    }
  }
  mcpJson.mcpServers = { ...(mcpJson.mcpServers ?? {}), ...merged };
  fs.writeFileSync(mcpPath, JSON.stringify(mcpJson, null, 2));

  const settingsDir = path.join(worktreePath, ".claude");
  const settingsPath = path.join(settingsDir, "settings.local.json");
  fs.mkdirSync(settingsDir, { recursive: true });
  let settings: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {
      settings = {};
    }
  }
  settings.enableAllProjectMcpServers = true;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  console.log(`[mcp] installed ${servers.join(", ")} into ${worktreePath}`);
  return servers;
}

/**
 * Gemini reads MCP servers from <cwd>/.gemini/settings.json (workspace
 * settings, merged over ~/.gemini/settings.json). This is the gemini-cli
 * parallel to installWorktreeMcpConfig: merge the named templates under the
 * `mcpServers` key of the worktree's workspace settings. No separate approval
 * flag is needed because the runtime spawns with --yolo (auto-approve).
 * Verified against gemini-cli v0.46.0: `gemini mcp list` resolves servers from
 * a workspace-level .gemini/settings.json. Returns the installed server names.
 */
export function installGeminiWorktreeMcpConfig(worktreePath: string, templateNames: string[]): string[] {
  const merged = mergeTemplates(templateNames);
  const servers = Object.keys(merged);
  if (servers.length === 0) return [];

  const settingsDir = path.join(worktreePath, ".gemini");
  const settingsPath = path.join(settingsDir, "settings.json");
  fs.mkdirSync(settingsDir, { recursive: true });
  let settings: { mcpServers?: Record<string, unknown> } = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {
      settings = {};
    }
  }
  settings.mcpServers = { ...(settings.mcpServers ?? {}), ...merged };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  console.log(`[mcp] installed gemini MCP ${servers.join(", ")} into ${worktreePath}`);
  return servers;
}
