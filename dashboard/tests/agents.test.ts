import { describe, it, expect } from "vitest";
import path from "node:path";
import { listAgents, getAgent, parseAgentFile } from "@/lib/agents";

const FIXTURES = path.join(__dirname, "fixtures", "agents");

describe("agents loader", () => {
  it("parses a single agent file", () => {
    const a = parseAgentFile(path.join(FIXTURES, "sample-agent.md"));
    expect(a.name).toBe("Sample Agent");
    expect(a.slug).toBe("sample-agent");
    expect(a.runtime).toBe("claude-code");
    expect(a["allowed-tools"]).toContain("Read");
    expect(a.skills).toContain("research");
    expect(a.systemPrompt).toContain("sample agent for testing");
  });

  it("listAgents returns all .md files in the directory", () => {
    const all = listAgents(FIXTURES);
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all.find(a => a.slug === "sample-agent")).toBeTruthy();
  });

  it("getAgent returns matching agent or null", () => {
    expect(getAgent("sample-agent", FIXTURES)?.name).toBe("Sample Agent");
    expect(getAgent("nope", FIXTURES)).toBeNull();
  });
});
