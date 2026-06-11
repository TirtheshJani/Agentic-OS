import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { listMcpTemplates } from "@/lib/mcp";

export interface ConnectionStatus {
  id: string;
  label: string;
  status: "connected" | "not-configured" | "unavailable" | "deferred";
  detail: string;
  setup: string[];
}

const CACHE_TTL_MS = 60_000;
let cache: { at: number; statuses: ConnectionStatus[] } | null = null;

function cli(bin: string, args: string[]): { ok: boolean; out: string } {
  // shell:true on win32 resolves both .exe (gh) and npm .cmd shims (claude,
  // gemini) via PATHEXT, so the plain name works for all of them.
  const r = spawnSync(bin, args, { encoding: "utf8", shell: process.platform === "win32", timeout: 10_000 });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function checkClaude(): ConnectionStatus {
  const r = cli("claude", ["--version"]);
  const version = r.out.match(/(\d+\.\d+\.\d+)/)?.[1];
  return {
    id: "claude",
    label: "Claude Code (Max plan)",
    status: r.ok ? "connected" : "unavailable",
    detail: r.ok ? `CLI v${version ?? "?"} on PATH; agent runs bill your Max plan via the logged-in CLI.` : "claude not found on PATH",
    setup: r.ok ? [] : ["npm install -g @anthropic-ai/claude-code", "Run `claude` once and log in."],
  };
}

function checkGemini(): ConnectionStatus {
  const r = cli("gemini", ["--version"]);
  const version = r.out.match(/(\d+\.\d+\.\d+)/)?.[1];
  const geminiDir = path.join(os.homedir(), ".gemini");
  const hasProfile = fs.existsSync(geminiDir);
  if (!r.ok) {
    return {
      id: "gemini",
      label: "Gemini CLI (Google AI Pro)",
      status: "unavailable",
      detail: "gemini not found on PATH",
      setup: ["npm install -g @google/gemini-cli", "Run `gemini` once and log in with your Google account."],
    };
  }
  return {
    id: "gemini",
    label: "Gemini CLI (Google AI Pro)",
    status: hasProfile ? "connected" : "not-configured",
    detail: hasProfile
      ? `CLI v${version ?? "?"}; ~/.gemini profile present.`
      : `CLI v${version ?? "?"} installed but no ~/.gemini profile; log in once.`,
    setup: hasProfile ? [] : ["Run `gemini` once and complete Google OAuth (AI Pro account)."],
  };
}

function checkGitHub(): ConnectionStatus {
  const r = cli("gh", ["auth", "status"]);
  const account = r.out.match(/account\s+(\S+)/)?.[1];
  return {
    id: "github",
    label: "GitHub (gh CLI)",
    status: r.ok ? "connected" : "not-configured",
    detail: r.ok ? `Authenticated${account ? ` as ${account}` : ""}; agents use gh inside runs.` : "gh not authenticated",
    setup: r.ok ? [] : ["winget install GitHub.cli", "gh auth login"],
  };
}

function checkMcp(id: string, label: string, recommended: string): ConnectionStatus {
  const tpl = listMcpTemplates().find((t) => t.name === id);
  if (!tpl) {
    return {
      id,
      label,
      status: "not-configured",
      detail: `No template at .agentic-os/mcp/${id}.json`,
      setup: [
        `Configure on this page (saved to .agentic-os/mcp/${id}.json, gitignored).`,
        `Recommended server: ${recommended}.`,
        `Then add "mcp-servers: [${id}]" to a project's PROJECT.md frontmatter.`,
      ],
    };
  }
  return {
    id,
    label,
    status: "connected",
    detail: `${tpl.servers.length} server(s) configured: ${tpl.servers.join(", ")}. Injected into run worktrees of projects listing "${id}".`,
    setup: [],
  };
}

export async function getConnectionStatuses(): Promise<ConnectionStatus[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.statuses;
  const statuses: ConnectionStatus[] = [
    checkClaude(),
    checkGemini(),
    checkGitHub(),
    checkMcp("gmail", "Gmail (MCP, multi-account)", "GongRzhe/Gmail-MCP-Server (one entry per account)"),
    checkMcp("calendar", "Google Calendar (MCP)", "a Google Calendar MCP server"),
    {
      id: "linkedin",
      label: "LinkedIn",
      status: "deferred",
      detail: "Deferred by decision: no sanctioned personal-read API in 2026. Connector slot reserved; see spec 0011.",
      setup: [],
    },
  ];
  cache = { at: Date.now(), statuses };
  return statuses;
}
