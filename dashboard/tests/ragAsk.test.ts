import { describe, it, expect } from "vitest";
import { buildGroundedPrompt, parseCitations } from "@/lib/rag/ask";
import type { RetrievedChunk } from "@/lib/rag/retrieval";

const CHUNKS: RetrievedChunk[] = [
  {
    notePath: "wiki/a.md",
    title: "Note A",
    heading: "Methods",
    chunkIndex: 0,
    content: "Content of A",
    score: 0.5,
    retrievers: ["vector"],
  },
  {
    notePath: "wiki/b.md",
    title: "Note B",
    heading: "",
    chunkIndex: 0,
    content: "Content of B",
    score: 0.3,
    retrievers: ["fts"],
  },
];

describe("buildGroundedPrompt", () => {
  it("numbers context blocks and includes paths and the question", () => {
    const prompt = buildGroundedPrompt("what is A?", CHUNKS);
    expect(prompt).toContain("[1] (wiki/a.md — Methods)");
    expect(prompt).toContain("[2] (wiki/b.md)");
    expect(prompt).toContain("Content of A");
    expect(prompt).toContain("Question: what is A?");
    expect(prompt).toContain("Cite the blocks");
  });
});

describe("parseCitations", () => {
  it("extracts cited block numbers mapped to note paths", () => {
    const citations = parseCitations("A is described in [1], confirmed by [2] and again [1].", CHUNKS);
    expect(citations).toEqual([
      { n: 1, notePath: "wiki/a.md", title: "Note A" },
      { n: 2, notePath: "wiki/b.md", title: "Note B" },
    ]);
  });

  it("ignores out-of-range citation numbers", () => {
    const citations = parseCitations("See [3] and [12] and [0].", CHUNKS);
    expect(citations).toEqual([]);
  });

  it("returns empty for an answer with no citations", () => {
    expect(parseCitations("No idea.", CHUNKS)).toEqual([]);
  });
});
