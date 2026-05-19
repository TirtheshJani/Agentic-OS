#!/usr/bin/env node
// Validate every agents/**/*.md profile.
// Exits non-zero on any violation.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const agentsRoot = path.join(repoRoot, "agents");
const skillsRoot = path.join(repoRoot, "skills");

const DEPARTMENTS = new Set([
  "research",
  "coding",
  "content",
  "business",
  "productivity",
]);

const ALLOWED_TOP_LEVEL = new Set([
  "name",
  "description",
  "model",
  "department",
  "role",
  "allowed-skills",
  "allowed-tools",
  "system-prompt",
  // Phase 8.4: absolute (or repo-relative) path to the agent's default
  // working repo for "Open in terminal" launches.
  "default-repo",
]);

// Mirrors resolveDefaultRepo in dashboard/lib/agents-loader.ts. Kept in sync
// by hand — the validator is a separate process and cannot import TS.
function resolveDefaultRepoPath(raw) {
  if (!raw) return repoRoot;
  if (path.isAbsolute(raw)) return path.resolve(raw);
  if (/^[a-zA-Z]:[\\/]/.test(raw)) return path.resolve(raw);
  return path.resolve(repoRoot, raw);
}

function walkAgents(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "_prompts") continue;
      walkAgents(full, out);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
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

function validate(file, skillNames) {
  const errs = [];
  const warns = [];
  const stem = path.basename(file, ".md");
  const raw = fs.readFileSync(file, "utf8");
  const fm = matter(raw).data;

  for (const key of Object.keys(fm)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) {
      errs.push(`invalid top-level key "${key}" (allowed: ${[...ALLOWED_TOP_LEVEL].join(", ")})`);
    }
  }

  if (!fm.name) errs.push("name: required");
  if (!fm.department) errs.push("department: required");
  if (!fm.role) errs.push("role: required");

  if (typeof fm.name === "string") {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(fm.name)) {
      errs.push(`name: must be kebab-case (got "${fm.name}")`);
    }
    if (stem !== fm.name) {
      errs.push(`name "${fm.name}" must match filename stem "${stem}"`);
    }
  }

  if (typeof fm.department === "string" && !DEPARTMENTS.has(fm.department)) {
    errs.push(`department: "${fm.department}" not in (${[...DEPARTMENTS].join(", ")})`);
  }

  if (fm.role !== "lead" && fm.role !== "member") {
    errs.push(`role: must be "lead" or "member" (got "${fm.role}")`);
  }

  if (Array.isArray(fm["allowed-skills"])) {
    for (const s of fm["allowed-skills"]) {
      if (typeof s !== "string") {
        errs.push(`allowed-skills: every entry must be a string`);
        continue;
      }
      if (!skillNames.has(s)) {
        errs.push(`allowed-skills: "${s}" not found in skills/**/SKILL.md`);
      }
    }
  }

  if (typeof fm["system-prompt"] === "string") {
    const promptPath = path.resolve(path.dirname(file), fm["system-prompt"]);
    if (!fs.existsSync(promptPath)) {
      errs.push(`system-prompt: file does not exist (${fm["system-prompt"]})`);
    }
  }

  // default-repo: WARN (not FAIL) when the resolved path is missing on disk.
  // A non-string value is still a hard fail because the field is typed.
  if (fm["default-repo"] !== undefined) {
    if (typeof fm["default-repo"] !== "string") {
      errs.push(`default-repo: must be a string (got ${typeof fm["default-repo"]})`);
    } else if (fm["default-repo"].trim().length === 0) {
      errs.push(`default-repo: must not be empty`);
    } else {
      const resolved = resolveDefaultRepoPath(fm["default-repo"].trim());
      let ok = false;
      try {
        ok = fs.statSync(resolved).isDirectory();
      } catch {
        ok = false;
      }
      if (!ok) {
        warns.push(`default-repo path does not exist (${resolved})`);
      }
    }
  }

  return { errs, warns };
}

function main() {
  if (!fs.existsSync(agentsRoot)) {
    console.error(`FAIL  agents/ directory does not exist at ${agentsRoot}`);
    process.exit(1);
  }
  const skillNames = collectSkillNames();
  const files = walkAgents(agentsRoot);
  const byDept = new Map();
  let bad = 0;

  for (const f of files) {
    const { errs, warns } = validate(f, skillNames);
    const rel = path.relative(repoRoot, f);
    if (errs.length === 0) {
      console.log(`OK    ${rel}`);
    } else {
      bad++;
      console.error(`FAIL  ${rel}`);
      for (const e of errs) console.error(`        - ${e}`);
    }
    for (const w of warns) {
      console.warn(`WARN  ${rel}  ${w}`);
    }
    const fm = matter(fs.readFileSync(f, "utf8")).data;
    if (fm.department && fm.role === "lead") {
      const list = byDept.get(fm.department) ?? [];
      list.push(rel);
      byDept.set(fm.department, list);
    }
  }

  for (const [dept, leads] of byDept) {
    if (leads.length > 1) {
      bad++;
      console.error(`FAIL  department "${dept}" has ${leads.length} leads:`);
      for (const lead of leads) console.error(`        - ${lead}`);
    }
  }

  console.log(`\n${files.length} agent(s) checked, ${bad} failed.`);
  process.exit(bad === 0 ? 0 : 1);
}

main();
