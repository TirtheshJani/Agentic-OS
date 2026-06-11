// dashboard/lib/rag/chunker.ts
// Heading-aware markdown chunker for the vault RAG layer (spec 0013).
// Pure functions: note in, chunks out. The content hash keys the embedding
// cache, so it must be stable for unchanged content.
import crypto from "node:crypto";

export interface ChunkInput {
  relPath: string;
  title: string;
  body: string;
}

export interface Chunk {
  chunkIndex: number;
  heading: string;
  content: string;
  /** Text actually embedded: title + heading breadcrumb + content. */
  embedText: string;
  contentHash: string;
}

const TARGET_CHARS = 1600;
const HARD_MAX_CHARS = 2400;
const MIN_CHARS = 300;
const OVERLAP_CHARS = 200;

export function hashContent(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

interface Section {
  heading: string;
  text: string;
}

/** Split body into sections on ## / ### headings, tracking a breadcrumb. */
function splitSections(body: string): Section[] {
  const lines = body.split("\n");
  const sections: Section[] = [];
  let h2 = "";
  let h3 = "";
  let buf: string[] = [];

  const flush = () => {
    const text = buf.join("\n").trim();
    if (text) {
      const heading = h3 ? (h2 ? `${h2} > ${h3}` : h3) : h2;
      sections.push({ heading, text });
    }
    buf = [];
  };

  for (const line of lines) {
    const m2 = line.match(/^##\s+(.+)$/);
    const m3 = line.match(/^###\s+(.+)$/);
    if (m2) {
      flush();
      h2 = m2[1].trim();
      h3 = "";
    } else if (m3) {
      flush();
      h3 = m3[1].trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

/** Split an oversized section on paragraph boundaries with overlap. */
function splitLong(text: string): string[] {
  if (text.length <= HARD_MAX_CHARS) return [text];
  const paragraphs = text.split(/\n{2,}/);
  const parts: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    const candidate = current ? `${current}\n\n${p}` : p;
    if (candidate.length > TARGET_CHARS && current) {
      parts.push(current);
      current = `${current.slice(-OVERLAP_CHARS)}\n\n${p}`;
    } else {
      current = candidate;
    }
    // A single paragraph longer than the hard max gets hard-split.
    while (current.length > HARD_MAX_CHARS) {
      parts.push(current.slice(0, TARGET_CHARS));
      current = current.slice(TARGET_CHARS - OVERLAP_CHARS);
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

export function chunkNote(input: ChunkInput): Chunk[] {
  const sections = splitSections(input.body);
  const pieces: Array<{ heading: string; content: string }> = [];

  for (const section of sections) {
    for (const part of splitLong(section.text)) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // Merge fragments into the previous piece instead of emitting noise.
      const prev = pieces[pieces.length - 1];
      if (trimmed.length < MIN_CHARS && prev && prev.content.length + trimmed.length <= HARD_MAX_CHARS) {
        prev.content = `${prev.content}\n\n${trimmed}`;
      } else {
        pieces.push({ heading: section.heading, content: trimmed });
      }
    }
  }

  return pieces.map((p, i) => {
    const breadcrumb = p.heading ? `${input.title} > ${p.heading}` : input.title;
    const embedText = `${breadcrumb}\n\n${p.content}`;
    return {
      chunkIndex: i,
      heading: p.heading,
      content: p.content,
      embedText,
      contentHash: hashContent(embedText),
    };
  });
}
