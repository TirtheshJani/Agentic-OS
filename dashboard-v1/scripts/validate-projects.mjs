#!/usr/bin/env node
// Validate every vault/projects/<slug>/PROJECT.md against the schema
// documented in vault/projects/README.md.
//
// Hard fails (exit non-zero):
//   - missing required field (name, slug, description, status)
//   - slug not kebab-case or does not match folder name
//   - name not kebab-case
//   - status not in {active, dormant, archived}
//
// Warnings (still exit 0):
//   - branch not in the documented allowed set (repos may evolve)
//   - path is set but the resolved directory does not exist (repos can move)
//   - allowed-skills entry not found in skills/**/SKILL.md
//
// Exits non-zero on any FAIL.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const projectsRoot = path.join(repoRoot, "vault", "projects");
const skillsRoot = path.join(repoRoot, "skills");

const ALLOWED_STATUS = new Set(["active", "dormant", "archived"]);
const ALLOWED_GITHUB_SYNC = new Set(["read-only", "write-back"]);
const ALLOWED_BRANCH = new Set([
  "meta",
  "productivity",
  "research",
  "physics",
  "healthcare-ai",
  "aiml",
  "quantum",
  "content",
  "career",
  "coding",
  "other",
]);

// Mirror dashboard/lib/projects-loader.ts resolveProjectPath.
function resolveProjectPath(rawPath) {
  if (!rawPath) return repoRoot;
  if (path.isAbsolute(rawPath)) return path.resolve(rawPath);
  if (/^[a-zA-Z]:[\\/]/.test(rawPath)) return path.resolve(rawPath);
  return path.resolve(repoRoot, rawPath);
}

function collectSkillNames() {
  const names = new Set();
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name === "SKILL.md") {
        const raw = fs.readFileSync(full, "utf8");
        const fm = matter(raw).data;
        if (typeof fm.name === "string") names.add(fm.name);
      }
    }
  }
  walk(skillsRoot);
  return names;
}

function collectProjectFiles() {
  const out = [];
  for (const e of fs.readdirSync(projectsRoot, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const file = path.join(projectsRoot, e.name, "PROJECT.md");
    if (fs.existsSync(file)) out.push({ folder: e.name, file });
  }
  return out;
}

function validate(entry, skillNames) {
  const errs = [];
  const warns = [];
  const { folder, file } = entry;
  const raw = fs.readFileSync(file, "utf8");
  const fm = matter(raw).data;

  if (!fm.name) errs.push("name: required");
  if (!fm.slug) errs.push("slug: required");
  if (!fm.description) errs.push("description: required");
  if (!fm.status) errs.push("status: required");

  if (typeof fm.name === "string" && !/^[a-z0-9][a-z0-9-]*$/.test(fm.name)) {
    errs.push(`name: must be kebab-case (got "${fm.name}")`);
  }

  if (typeof fm.slug === "string") {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(fm.slug)) {
      errs.push(`slug: must be kebab-case (got "${fm.slug}")`);
    }
    if (fm.slug !== folder) {
      errs.push(`slug "${fm.slug}" must match folder name "${folder}"`);
    }
  }

  if (typeof fm.status === "string" && !ALLOWED_STATUS.has(fm.status)) {
    errs.push(
      `status: "${fm.status}" not in (${[...ALLOWED_STATUS].join(", ")})`
    );
  }

  if (typeof fm.branch === "string" && !ALLOWED_BRANCH.has(fm.branch)) {
    warns.push(
      `branch: "${fm.branch}" not in documented set (${[...ALLOWED_BRANCH].join(
        ", "
      )})`
    );
  }

  if (typeof fm.path === "string" && fm.path) {
    const resolved = resolveProjectPath(fm.path);
    let exists = false;
    try {
      exists = fs.statSync(resolved).isDirectory();
    } catch {
      exists = false;
    }
    if (!exists) {
      warns.push(`path: directory does not exist (${resolved})`);
    }
  }

  // Phase 8.5: github-sync gating. If the key is set it must be one of
  // the two literals. We do NOT probe `gh` availability here — the
  // validator runs on machines without gh installed, and the runtime
  // path handles missing gh gracefully via checkGhAvailable().
  if (typeof fm["github-sync"] !== "undefined") {
    if (
      typeof fm["github-sync"] !== "string" ||
      !ALLOWED_GITHUB_SYNC.has(fm["github-sync"])
    ) {
      errs.push(
        `github-sync: "${fm["github-sync"]}" not in (${[...ALLOWED_GITHUB_SYNC].join(", ")})`
      );
    }
  }

  if (Array.isArray(fm["allowed-skills"])) {
    for (const s of fm["allowed-skills"]) {
      if (typeof s !== "string") {
        errs.push(`allowed-skills: every entry must be a string`);
        continue;
      }
      if (!skillNames.has(s)) {
        warns.push(`allowed-skills: "${s}" not found in skills/**/SKILL.md`);
      }
    }
  }

  return { errs, warns };
}

function main() {
  if (!fs.existsSync(projectsRoot)) {
    console.error(
      `FAIL  vault/projects/ directory does not exist at ${projectsRoot}`
    );
    process.exit(1);
  }
  const skillNames = collectSkillNames();
  const entries = collectProjectFiles();
  let bad = 0;
  let warned = 0;

  for (const entry of entries) {
    const { errs, warns } = validate(entry, skillNames);
    const rel = path.relative(repoRoot, entry.file);
    if (errs.length === 0) {
      console.log(`OK    ${rel}`);
    } else {
      bad++;
      console.error(`FAIL  ${rel}`);
      for (const e of errs) console.error(`        - ${e}`);
    }
    if (warns.length > 0) {
      warned++;
      for (const w of warns) console.log(`WARN  ${rel}: ${w}`);
    }
  }

  console.log(
    `\n${entries.length} project(s) checked, ${bad} failed, ${warned} warned.`
  );
  process.exit(bad === 0 ? 0 : 1);
}

main();
