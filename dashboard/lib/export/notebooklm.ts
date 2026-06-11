// dashboard/lib/export/notebooklm.ts
// NotebookLM bridge (spec 0017, ADR-014): export selected vault notes as a
// markdown bundle to a local folder. Pointed at a Google Drive for Desktop
// synced folder, the bundle appears in Drive with zero credentials and
// NotebookLM imports it from there. Default fallback keeps bundles in the
// vault so they are at least git-synced.
import fs from "node:fs";
import path from "node:path";
import { VAULT_DIR } from "@/lib/paths";
import { getSettings } from "@/lib/settings";

export interface ExportResult {
  exportedTo: string;
  files: string[];
}

function kebab(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function exportBundle(opts: { paths: string[]; bundleName?: string }): ExportResult {
  if (opts.paths.length === 0) throw new Error("no notes selected");

  const sources: Array<{ rel: string; abs: string }> = opts.paths.map((rel) => {
    const abs = path.resolve(VAULT_DIR, rel);
    if (!abs.startsWith(path.resolve(VAULT_DIR) + path.sep)) throw new Error(`path outside vault: ${rel}`);
    if (!rel.endsWith(".md") || !fs.existsSync(abs)) throw new Error(`note not found: ${rel}`);
    return { rel, abs };
  });

  const baseDir = getSettings().export.notebookLmDir || path.join(VAULT_DIR, "outputs", "notebooklm");
  const date = new Date().toISOString().slice(0, 10);
  const bundle = kebab(opts.bundleName || "bundle") || "bundle";
  let dir = path.join(baseDir, `${date}-${bundle}`);
  for (let i = 2; fs.existsSync(dir); i++) dir = path.join(baseDir, `${date}-${bundle}-${i}`);
  fs.mkdirSync(dir, { recursive: true });

  const files: string[] = [];
  for (const s of sources) {
    // Flatten the vault path into the filename so provenance survives the copy.
    const flat = kebab(s.rel.replace(/\.md$/, "").replace(/\//g, "-")) + ".md";
    const content = fs
      .readFileSync(s.abs, "utf8")
      // NotebookLM has no wikilink concept; flatten [[target|label]] / [[target]].
      .replace(/\[\[([^\]|#\n]+)(?:\|([^\]\n]+))?\]\]/g, (_, target: string, label?: string) => label ?? target);
    fs.writeFileSync(path.join(dir, flat), content);
    files.push(flat);
  }

  const manifest = [
    `# Bundle manifest`,
    "",
    `Exported: ${new Date().toISOString()}`,
    "",
    "Sources:",
    ...sources.map((s, i) => `- ${files[i]} <- vault/${s.rel}`),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(dir, "_manifest.md"), manifest);
  files.push("_manifest.md");

  return { exportedTo: dir, files };
}
