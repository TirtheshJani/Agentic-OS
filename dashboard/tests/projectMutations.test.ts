import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";
import {
  createProjectFromExistingFolder,
  slugify,
  updateProjectCrew,
} from "@/lib/projectMutations";

let WORK: string;

beforeEach(() => {
  WORK = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-projmut-"));
});

afterEach(() => {
  fs.rmSync(WORK, { recursive: true, force: true });
});

describe("slugify", () => {
  it("lowercases and dashes", () => {
    expect(slugify("My Cool Project!")).toBe("my-cool-project");
    expect(slugify("QML Healthcare Diagnostics")).toBe("qml-healthcare-diagnostics");
    expect(slugify("foo_bar baz")).toBe("foo-bar-baz");
  });
  it("strips leading non-alphanumeric", () => {
    expect(slugify("--my proj")).toBe("my-proj");
  });
});

describe("createProjectFromExistingFolder", () => {
  it("creates a PROJECT.md pointing to the given path", () => {
    const folder = path.join(WORK, "src", "myproj");
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "README.md"), "# x");

    const vaultDir = path.join(WORK, "vault", "projects");
    const result = createProjectFromExistingFolder({
      name: "My Proj",
      folderPath: folder,
      vaultProjectsDir: vaultDir,
    });

    expect(result.slug).toBe("my-proj");
    expect(fs.existsSync(path.join(vaultDir, "my-proj", "PROJECT.md"))).toBe(true);
    const parsed = matter(fs.readFileSync(path.join(vaultDir, "my-proj", "PROJECT.md"), "utf8"));
    expect(parsed.data.name).toBe("My Proj");
    expect(parsed.data.path).toBe(folder);
    expect(parsed.data.crew).toEqual([]);
    expect(parsed.data["runtime-default"]).toBe("claude-code");
  });

  it("detects a git repo and sets repo URL from remote", () => {
    const folder = path.join(WORK, "src", "gitproj");
    fs.mkdirSync(path.join(folder, ".git"), { recursive: true });
    fs.writeFileSync(path.join(folder, ".git", "config"), `
[remote "origin"]
\turl = https://github.com/foo/bar.git
`);

    const result = createProjectFromExistingFolder({
      name: "Git Proj",
      folderPath: folder,
      vaultProjectsDir: path.join(WORK, "vault", "projects"),
    });

    const parsed = matter(fs.readFileSync(result.projectFilePath, "utf8"));
    expect(parsed.data.repo).toBe("https://github.com/foo/bar.git");
  });

  it("refuses if a project with the same slug already exists", () => {
    const folder = path.join(WORK, "myproj");
    fs.mkdirSync(folder, { recursive: true });

    createProjectFromExistingFolder({
      name: "My Proj",
      folderPath: folder,
      vaultProjectsDir: path.join(WORK, "vault", "projects"),
    });

    expect(() =>
      createProjectFromExistingFolder({
        name: "My Proj",
        folderPath: folder,
        vaultProjectsDir: path.join(WORK, "vault", "projects"),
      })
    ).toThrow(/already exists/i);
  });

  it("refuses if the folder does not exist", () => {
    expect(() =>
      createProjectFromExistingFolder({
        name: "Ghost",
        folderPath: path.join(WORK, "does-not-exist"),
        vaultProjectsDir: path.join(WORK, "vault", "projects"),
      })
    ).toThrow(/does not exist/i);
  });
});

describe("updateProjectCrew", () => {
  it("rewrites the crew field", () => {
    const projectFile = path.join(WORK, "vault", "projects", "x", "PROJECT.md");
    fs.mkdirSync(path.dirname(projectFile), { recursive: true });
    fs.writeFileSync(projectFile, `---
name: X
slug: x
path: /tmp
crew: [a, b]
runtime-default: claude-code
capabilities: [research]
created: 2026-01-01
---
body
`);
    updateProjectCrew(projectFile, ["c", "d", "e"]);
    const parsed = matter(fs.readFileSync(projectFile, "utf8"));
    expect(parsed.data.crew).toEqual(["c", "d", "e"]);
    expect(parsed.content.trim()).toBe("body");
  });
});
