#!/usr/bin/env node
// Validate every SKILL.md in ../skills/ against the official Anthropic
// Skills spec plus this repo's local conventions (standards/skill-authoring.md).
//
// Exits non-zero on any violation.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const skillsRoot = path.join(repoRoot, "skills");

const ALLOWED_TOP_LEVEL = new Set([
  "name",
  "description",
  "license",
  "allowed-tools",
  "metadata",
]);
const RESERVED_NAME_PREFIXES = ["claude", "anthropic"];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && e.name === "SKILL.md") out.push(full);
  }
  return out;
}

function parseFrontmatter(raw) {
  raw = raw.replace(/\r\n/g, "\n");
  if (!raw.startsWith("---\n")) return null;
  const end = raw.indexOf("\n---", 4);
  if (end < 0) return null;
  const block = raw.slice(4, end);
  return parseYamlMinimal(block);
}

// Minimal YAML parser: top-level keys + recursive nested mappings/sequences.
// Sufficient for frontmatter we control. Not a general YAML parser.
function parseYamlMinimal(text) {
  const lines = text.split("\n");
  const root = {};
  parseBlock(lines, 0, 0, root);
  return root;
}

function parseBlock(lines, i, indent, out) {
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) {
      i++;
      continue;
    }
    const cur = leading(line);
    if (cur < indent) return i;
    const m = line.slice(indent).match(/^([\w-]+):\s*(.*)$/);
    if (!m) return i;
    const [, key, rest] = m;
    if (rest === "") {
      // nested mapping or sequence
      const nextIndent = i + 1 < lines.length ? leading(lines[i + 1]) : indent + 2;
      if (nextIndent > indent) {
        const isSeq = lines[i + 1] && lines[i + 1].slice(nextIndent).startsWith("- ");
        if (isSeq) {
          const arr = [];
          let j = i + 1;
          while (j < lines.length && leading(lines[j]) === nextIndent && lines[j].slice(nextIndent).startsWith("- ")) {
            arr.push(parseScalar(lines[j].slice(nextIndent + 2).trim()));
            j++;
          }
          out[key] = arr;
          i = j;
          continue;
        } else {
          const child = {};
          out[key] = child;
          i = parseBlock(lines, i + 1, nextIndent, child);
          continue;
        }
      }
      out[key] = "";
    } else {
      out[key] = parseScalar(rest);
    }
    i++;
  }
  return i;
}

function leading(line) {
  let n = 0;
  while (n < line.length && line[n] === " ") n++;
  return n;
}

function parseScalar(raw) {
  raw = raw.trim();
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((s) => parseScalar(s.trim()));
  }
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

function validate(file) {
  const errs = [];
  const folder = path.dirname(file);
  const slug = path.basename(folder);
  const raw = fs.readFileSync(file, "utf8");

  // No README.md inside the skill folder
  if (fs.existsSync(path.join(folder, "README.md"))) {
    errs.push("README.md found inside skill folder (forbidden by spec)");
  }

  const fm = parseFrontmatter(raw);
  if (!fm) {
    errs.push("missing or malformed frontmatter");
    return errs;
  }
  for (const key of Object.keys(fm)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) {
      errs.push(
        `invalid top-level frontmatter key "${key}" (allowed: ${[...ALLOWED_TOP_LEVEL].join(", ")})`
      );
    }
  }
  if (!fm.name) errs.push("name: required");
  if (!fm.description) errs.push("description: required");
  if (typeof fm.name === "string") {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(fm.name)) {
      errs.push(`name: must be kebab-case (got "${fm.name}")`);
    }
    for (const prefix of RESERVED_NAME_PREFIXES) {
      if (fm.name.toLowerCase().startsWith(prefix)) {
        errs.push(`name: must not start with reserved prefix "${prefix}"`);
      }
    }
    if (slug !== fm.name) {
      errs.push(`name "${fm.name}" must match folder name "${slug}"`);
    }
  }
  if (typeof fm.description === "string") {
    if (fm.description.length > 1024) {
      errs.push(`description: ${fm.description.length} chars (max 1024)`);
    }
    if (/[<>]/.test(fm.description)) {
      errs.push("description: contains forbidden < or > chars");
    }
  }
  return errs;
}

function main() {
  const files = walk(skillsRoot);
  let bad = 0;
  for (const f of files) {
    const errs = validate(f);
    const rel = path.relative(repoRoot, f);
    if (errs.length === 0) {
      console.log(`OK    ${rel}`);
    } else {
      bad++;
      console.error(`FAIL  ${rel}`);
      for (const e of errs) console.error(`        - ${e}`);
    }
  }
  console.log(`\n${files.length} skill(s) checked, ${bad} failed.`);
  process.exit(bad === 0 ? 0 : 1);
}

main();
