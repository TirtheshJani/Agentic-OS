import { describe, it, expect } from "vitest";
import path from "node:path";
import { listProjects, getProject, parseProjectFile } from "@/lib/projects";

const FIXTURES = path.join(__dirname, "fixtures", "vault", "projects");

describe("projects loader", () => {
  it("parses a single PROJECT.md", () => {
    const p = parseProjectFile(path.join(FIXTURES, "sample", "PROJECT.md"));
    expect(p.name).toBe("Sample Project");
    expect(p.slug).toBe("sample");
    expect(p.crew).toEqual(["lit-reviewer", "physicist"]);
    expect(p["runtime-default"]).toBe("claude-code");
  });

  it("listProjects skips directories without PROJECT.md", () => {
    const all = listProjects(FIXTURES);
    expect(all).toHaveLength(1);
    expect(all[0].slug).toBe("sample");
  });

  it("getProject returns the matching project or null", () => {
    expect(getProject("sample", FIXTURES)?.name).toBe("Sample Project");
    expect(getProject("nope", FIXTURES)).toBeNull();
  });
});
