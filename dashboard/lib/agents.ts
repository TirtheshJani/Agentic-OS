import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { parseAgentFrontmatter, AgentFrontmatter } from "@/lib/schemas";
import { AGENTS_DIR } from "@/lib/paths";

export interface Agent extends AgentFrontmatter {
  filePath: string;
  systemPrompt: string;
  lastModified: number;
}

function stripSystemPromptHeading(body: string): string {
  return body.replace(/^#\s*System Prompt\s*\n+/i, "").trim();
}

export function parseAgentFile(filePath: string): Agent {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const fm = parseAgentFrontmatter(parsed.data);
  const stat = fs.statSync(filePath);
  return {
    ...fm,
    filePath,
    systemPrompt: stripSystemPromptHeading(parsed.content),
    lastModified: stat.mtimeMs,
  };
}

export function listAgents(rootDir: string = AGENTS_DIR): Agent[] {
  if (!fs.existsSync(rootDir)) return [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const agents: Agent[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (entry.name === "README.md" || entry.name === "CLAUDE.md") continue;
    try {
      agents.push(parseAgentFile(path.join(rootDir, entry.name)));
    } catch (err) {
      console.warn(`[agents] skipping ${entry.name}: ${(err as Error).message}`);
    }
  }
  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

export function getAgent(slug: string, rootDir: string = AGENTS_DIR): Agent | null {
  const candidates = [
    path.join(rootDir, `${slug}.md`),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        return parseAgentFile(c);
      } catch {
        return null;
      }
    }
  }
  return null;
}
