import { describe, it, expect } from "vitest";
import { ProjectFrontmatterSchema, AgentFrontmatterSchema, parseProjectFrontmatter, parseAgentFrontmatter } from "@/lib/schemas";

describe("ProjectFrontmatterSchema", () => {
  it("accepts a complete project frontmatter", () => {
    const ok = ProjectFrontmatterSchema.safeParse({
      name: "QML Healthcare",
      slug: "qml-healthcare",
      path: "C:/Users/TJ/code/qml-healthcare",
      repo: "https://github.com/x/y",
      crew: ["lit-reviewer", "physicist"],
      "runtime-default": "claude-code",
      capabilities: ["research", "physics"],
      created: "2026-05-20",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects when slug has whitespace", () => {
    const bad = ProjectFrontmatterSchema.safeParse({
      name: "x",
      slug: "with space",
      path: "/x",
      "runtime-default": "claude-code",
      capabilities: [],
      crew: [],
      created: "2026-05-20",
    });
    expect(bad.success).toBe(false);
  });

  it("fills defaults for crew, capabilities, runtime-default", () => {
    const parsed = parseProjectFrontmatter({
      name: "x",
      slug: "x",
      path: "/x",
      created: "2026-05-20",
    });
    expect(parsed.crew).toEqual([]);
    expect(parsed.capabilities).toEqual([]);
    expect(parsed["runtime-default"]).toBe("claude-code");
  });
});

describe("AgentFrontmatterSchema", () => {
  it("accepts a complete agent frontmatter", () => {
    const ok = AgentFrontmatterSchema.safeParse({
      name: "Literature Reviewer",
      slug: "lit-reviewer",
      runtime: "claude-code",
      "allowed-tools": ["Read", "Edit"],
      skills: ["research", "literature-review"],
      created: "2026-01-01",
    });
    expect(ok.success).toBe(true);
  });

  it("fills defaults for allowed-tools and skills", () => {
    const parsed = parseAgentFrontmatter({
      name: "x",
      slug: "x",
      runtime: "claude-code",
      created: "2026-01-01",
    });
    expect(parsed["allowed-tools"]).toEqual([]);
    expect(parsed.skills).toEqual([]);
    expect(parsed.model).toBeUndefined();
  });

  it("accepts an optional model and rejects an empty one", () => {
    const withModel = parseAgentFrontmatter({
      name: "x",
      slug: "x",
      runtime: "claude-code",
      model: "opus",
      created: "2026-01-01",
    });
    expect(withModel.model).toBe("opus");
    const empty = AgentFrontmatterSchema.safeParse({
      name: "x",
      slug: "x",
      runtime: "claude-code",
      model: "",
      created: "2026-01-01",
    });
    expect(empty.success).toBe(false);
  });
});
