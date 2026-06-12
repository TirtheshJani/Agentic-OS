import { describe, it, expect } from "vitest";
import { chunkNote, hashContent } from "@/lib/rag/chunker";

const NOTE = {
  relPath: "wiki/test.md",
  title: "Test Note",
};

describe("chunkNote", () => {
  it("splits on headings with a breadcrumb", () => {
    const body = [
      "Intro paragraph that is long enough to stand on its own as a chunk of meaningful content. " + "x".repeat(300),
      "## Methods",
      "Methods content here. " + "y".repeat(400),
      "### Detail",
      "Detail content. " + "z".repeat(400),
    ].join("\n");
    const chunks = chunkNote({ ...NOTE, body });
    expect(chunks.length).toBe(3);
    expect(chunks[0].heading).toBe("");
    expect(chunks[1].heading).toBe("Methods");
    expect(chunks[2].heading).toBe("Methods > Detail");
    expect(chunks[1].embedText.startsWith("Test Note > Methods")).toBe(true);
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2]);
  });

  it("merges small fragments into the previous chunk", () => {
    const body = [
      "First section content. " + "a".repeat(400),
      "## Tiny",
      "Short.",
    ].join("\n");
    const chunks = chunkNote({ ...NOTE, body });
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toContain("Short.");
  });

  it("splits oversized sections with overlap", () => {
    const para = "word ".repeat(120).trim(); // ~600 chars
    const body = Array(8).fill(para).join("\n\n"); // ~4800 chars, one section
    const chunks = chunkNote({ ...NOTE, body });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(2400);
    }
  });

  it("produces stable hashes for unchanged content", () => {
    const body = "Stable content paragraph. " + "s".repeat(400);
    const a = chunkNote({ ...NOTE, body });
    const b = chunkNote({ ...NOTE, body });
    expect(a[0].contentHash).toBe(b[0].contentHash);
    expect(a[0].contentHash).toBe(hashContent(a[0].embedText));
  });

  it("returns no chunks for an empty body", () => {
    expect(chunkNote({ ...NOTE, body: "" })).toEqual([]);
    expect(chunkNote({ ...NOTE, body: "\n\n  \n" })).toEqual([]);
  });
});
