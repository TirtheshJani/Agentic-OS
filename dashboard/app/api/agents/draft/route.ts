import { NextResponse } from "next/server";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { listSkills } from "@/lib/skills";
import { extractJsonObject } from "@/lib/llm/extractJson";

// Same .cmd shim handling as lib/runtime/claude-code.ts.
const CLAUDE_BIN = process.platform === "win32" ? "claude.cmd" : "claude";

const RequestSchema = z.object({
  description: z.string().min(10, "describe the agent in at least a sentence"),
});

const DraftSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().default(""),
  skills: z.array(z.string()).default([]),
  allowedTools: z.array(z.string()).default([]),
  systemPrompt: z.string().min(1),
});

const KNOWN_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "WebFetch", "WebSearch"];

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const skillNames = listSkills().map((s) => s.name);
  const prompt = [
    "Draft an agent profile for a personal agent dashboard.",
    "Respond with ONLY a JSON object, no markdown fences and no prose, with these keys:",
    'name (kebab-case identifier, same as slug), slug (kebab-case),',
    "description (1-2 sentences rich in domain keywords; it is used for task routing),",
    `skills (array, choose ONLY from: ${skillNames.join(", ")}),`,
    `allowedTools (array, choose from: ${KNOWN_TOOLS.join(", ")}),`,
    "systemPrompt (the agent's system prompt, 100-250 words, imperative voice, second person).",
    `The agent should: ${parsed.data.description}`,
  ].join("\n");

  // ONE headless call per click. Headless subscription use draws from the
  // monthly Agent SDK credit pool (policy effective 2026-06-15), so this
  // endpoint must never loop or retry.
  const r = spawnSync(CLAUDE_BIN, ["-p", prompt, "--output-format", "json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
  });

  if (r.error || r.status !== 0) {
    const detail = r.error?.message || r.stderr || `exit ${r.status}`;
    console.error(`[agents.draft] claude -p failed: ${detail}`);
    return NextResponse.json({ error: `draft generation failed: ${detail}` }, { status: 502 });
  }

  // claude -p --output-format json wraps the reply in an envelope whose
  // `result` field holds the assistant text.
  let resultText = r.stdout;
  const envelope = extractJsonObject(r.stdout) as { result?: unknown } | null;
  if (envelope && typeof envelope.result === "string") resultText = envelope.result;

  const draftRaw = extractJsonObject(resultText);
  const draft = DraftSchema.safeParse(draftRaw);
  if (!draft.success) {
    console.error(`[agents.draft] unparseable draft:`, resultText.slice(0, 500));
    return NextResponse.json(
      { error: "model reply was not a valid draft", raw: resultText.slice(0, 2000) },
      { status: 502 }
    );
  }

  // Drop hallucinated skills/tools instead of failing; the form shows what survived.
  const knownSkills = new Set(skillNames);
  return NextResponse.json({
    draft: {
      ...draft.data,
      skills: draft.data.skills.filter((s) => knownSkills.has(s)),
      allowedTools: draft.data.allowedTools.filter((t) => KNOWN_TOOLS.includes(t)),
    },
  });
}
