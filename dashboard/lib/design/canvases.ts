// dashboard/lib/design/canvases.ts
// Architecture-studio canvases (spec 0023): scene JSON + an SVG export saved
// side by side in the project's vault folder, plus a .md stub so the diagram
// shows up in Obsidian and the graph (the indexer only walks .md files).
import fs from "node:fs";
import path from "node:path";
import { VAULT_PROJECTS_DIR } from "@/lib/paths";
import { slugRegex } from "@/lib/schemas";
import { indexVault } from "@/lib/vault/indexer";
import { publish } from "@/lib/stream";

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export interface CanvasInfo {
  name: string;
  mtime: number;
  hasSvg: boolean;
}

export interface DesignDoc {
  name: string;
  relPath: string;
}

function designDir(slug: string): string {
  if (!slugRegex.test(slug)) throw new Error(`invalid project slug: ${slug}`);
  return path.join(VAULT_PROJECTS_DIR, slug, "design");
}

export function designDirAbs(slug: string): string {
  return designDir(slug);
}

function assertName(name: string): void {
  if (!NAME_RE.test(name)) throw new Error(`invalid canvas name: ${name}`);
}

export function listCanvases(slug: string): CanvasInfo[] {
  const dir = designDir(slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".excalidraw.json"))
    .map((f) => {
      const name = f.replace(/\.excalidraw\.json$/, "");
      return {
        name,
        mtime: fs.statSync(path.join(dir, f)).mtimeMs,
        hasSvg: fs.existsSync(path.join(dir, `${name}.svg`)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listDesignDocs(slug: string): DesignDoc[] {
  const dir = designDir(slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !fs.existsSync(path.join(dir, f.replace(/\.md$/, ".excalidraw.json"))))
    .map((f) => ({ name: f, relPath: `projects/${slug}/design/${f}` }));
}

export function readCanvas(slug: string, name: string): unknown | null {
  assertName(name);
  const fp = path.join(designDir(slug), `${name}.excalidraw.json`);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}

export function saveCanvas(slug: string, name: string, scene: unknown, svg: string | null): void {
  assertName(name);
  const dir = designDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.excalidraw.json`), JSON.stringify(scene));
  if (svg) fs.writeFileSync(path.join(dir, `${name}.svg`), svg);

  // Obsidian/graph visibility stub, created once.
  const stub = path.join(dir, `${name}.md`);
  if (!fs.existsSync(stub)) {
    fs.writeFileSync(
      stub,
      `---\nsource: design-studio\ncreated: ${new Date().toISOString().slice(0, 10)}\n---\n\n# ${name} (diagram)\n\n![](${name}.svg)\n`
    );
    const stats = indexVault();
    publish({ kind: "vault.indexed", ...stats });
  }
}

export function deleteCanvas(slug: string, name: string): boolean {
  assertName(name);
  const dir = designDir(slug);
  let removed = false;
  for (const ext of [".excalidraw.json", ".svg", ".md"]) {
    const fp = path.join(dir, `${name}${ext}`);
    if (fs.existsSync(fp)) {
      fs.rmSync(fp);
      removed = true;
    }
  }
  if (removed) {
    const stats = indexVault();
    publish({ kind: "vault.indexed", ...stats });
  }
  return removed;
}
