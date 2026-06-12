import { describe, it, expect } from "vitest";
import { isGitHubRepo } from "@/lib/github";

describe("github lib", () => {
  it("isGitHubRepo recognizes https and ssh urls", () => {
    expect(isGitHubRepo("https://github.com/google/gemini-cli")).toBe(true);
    expect(isGitHubRepo("git@github.com:google/gemini-cli.git")).toBe(true);
    expect(isGitHubRepo("https://gitlab.com/google/gemini-cli")).toBe(false);
    expect(isGitHubRepo(undefined)).toBe(false);
  });
});
