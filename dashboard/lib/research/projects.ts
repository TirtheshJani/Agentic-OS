// dashboard/lib/research/projects.ts
// Research projects (spec 0019) are vault folders: vault/research/<slug>/ with
// RESEARCH.md, sources/, notes/, brief.md. The vault indexer and the RAG layer
// pick them up automatically; chat is a scoped /api/rag/ask.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { VAULT_DIR } from "@/lib/paths";
import { slugify } from "@/lib/projectMutations";
import { indexVault } from "@/lib/vault/indexer";
import { publish } from "@/lib/stream";

const RESEARCH_DIR = path.join(VAULT_DIR, "research");
const STATUSES = ["open", "active", "synthesized", "archived"] as const;
export type ResearchStatus = (typeof STATUSES)[number];

export interface ResearchProject {
  slug: string;
  title: string;
  question: string;
  status: ResearchStatus;
  created: string;
  tags: string[];
  sourceCount: number;
  noteCount: number;
  briefExists: boolean;
}

export interface ResearchSource {
  name: string;
  relPath: string;
  title: string;
  sourceUrl: string | null;
  sourceType: string | null;
  collectedBy: string | null;
  collectedAt: string | null;
  attributed: boolean;
}

export interface ResearchNote {
  name: string;
  relPath: string;
  mtime: number;
}

function projectDir(slug: string): string {
  const clean = slugify(slug);
  if (!clean || clean !== slug) throw new Error(`invalid research slug: ${slug}`);
  return path.join(RESEARCH_DIR, slug);
}

/** Absolute path to the project folder; used in issue templates. */
export function researchDirAbs(slug: string): string {
  return projectDir(slug);
}

export function researchScopePrefix(slug: string): string {
  return `research/${slug}/`;
}

function listMd(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort();
}

function readMeta(slug: string): { title: string; question: string; status: ResearchStatus; created: string; tags: string[] } | null {
  const fp = path.join(RESEARCH_DIR, slug, "RESEARCH.md");
  if (!fs.existsSync(fp)) return null;
  try {
    const fm = matter(fs.readFileSync(fp, "utf8")).data as Record<string, unknown>;
    const status = STATUSES.includes(fm.status as ResearchStatus) ? (fm.status as ResearchStatus) : "open";
    return {
      title: typeof fm.title === "string" && fm.title ? fm.title : slug,
      question: typeof fm.question === "string" ? fm.question : "",
      status,
      created: fm.created instanceof Date ? fm.created.toISOString().slice(0, 10) : String(fm.created ?? ""),
      tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
    };
  } catch {
    return { title: slug, question: "", status: "open", created: "", tags: [] };
  }
}

export function listResearchProjects(): ResearchProject[] {
  if (!fs.existsSync(RESEARCH_DIR)) return [];
  return fs
    .readdirSync(RESEARCH_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const meta = readMeta(e.name);
      if (!meta) return null;
      return {
        slug: e.name,
        ...meta,
        sourceCount: listMd(path.join(RESEARCH_DIR, e.name, "sources")).length,
        noteCount: listMd(path.join(RESEARCH_DIR, e.name, "notes")).length,
        briefExists: fs.existsSync(path.join(RESEARCH_DIR, e.name, "brief.md")),
      };
    })
    .filter((p): p is ResearchProject => p !== null)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function getResearchProject(slug: string): ResearchProject | null {
  return listResearchProjects().find((p) => p.slug === slug) ?? null;
}

export function createResearchProject(opts: { title: string; question: string; tags?: string[] }): ResearchProject {
  const slug = slugify(opts.title);
  if (!slug) throw new Error(`cannot derive a slug from title: ${opts.title}`);
  const dir = path.join(RESEARCH_DIR, slug);
  if (fs.existsSync(path.join(dir, "RESEARCH.md"))) throw new Error(`research project already exists: ${slug}`);

  fs.mkdirSync(path.join(dir, "sources"), { recursive: true });
  fs.mkdirSync(path.join(dir, "notes"), { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(
    path.join(dir, "RESEARCH.md"),
    [
      "---",
      `title: ${opts.title}`,
      `question: ${opts.question.replace(/\n/g, " ")}`,
      "status: open",
      `created: ${today}`,
      `tags: [${(opts.tags ?? []).join(", ")}]`,
      "---",
      "",
      `# ${opts.title}`,
      "",
      `**Question:** ${opts.question}`,
      "",
    ].join("\n")
  );
  const stats = indexVault();
  publish({ kind: "vault.indexed", ...stats });
  return getResearchProject(slug)!;
}

export function listSources(slug: string): ResearchSource[] {
  const dir = path.join(projectDir(slug), "sources");
  return listMd(dir).map((name) => {
    const relPath = `research/${slug}/sources/${name}`;
    try {
      const fm = matter(fs.readFileSync(path.join(dir, name), "utf8")).data as Record<string, unknown>;
      const sourceUrl = typeof fm["source-url"] === "string" ? fm["source-url"] : null;
      return {
        name,
        relPath,
        title: typeof fm.title === "string" && fm.title ? fm.title : name.replace(/\.md$/, ""),
        sourceUrl,
        sourceType: typeof fm["source-type"] === "string" ? fm["source-type"] : null,
        collectedBy: typeof fm["collected-by"] === "string" ? fm["collected-by"] : null,
        collectedAt:
          fm["collected-at"] instanceof Date
            ? (fm["collected-at"] as Date).toISOString().slice(0, 10)
            : typeof fm["collected-at"] === "string"
              ? fm["collected-at"]
              : null,
        attributed: sourceUrl !== null,
      };
    } catch {
      return {
        name,
        relPath,
        title: name.replace(/\.md$/, ""),
        sourceUrl: null,
        sourceType: null,
        collectedBy: null,
        collectedAt: null,
        attributed: false,
      };
    }
  });
}

export function listResearchNotes(slug: string): ResearchNote[] {
  const dir = path.join(projectDir(slug), "notes");
  return listMd(dir).map((name) => ({
    name,
    relPath: `research/${slug}/notes/${name}`,
    mtime: fs.statSync(path.join(dir, name)).mtimeMs,
  }));
}
