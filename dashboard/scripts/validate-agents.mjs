#!/usr/bin/env node
// Validate every agents/*.md profile against standards/agent-authoring.md.
// Asserts: frontmatter restricted to the allowed keys (ADR-005 parity);
// required fields present; slug is kebab-case and matches the filename;
// skills is a list of capability tags; description is sane.
// Warns (does not fail) on a vocab-less description (ADR-007 routing-health).
//
// Note: agent `skills` are coarse capability tags matched against project
// `capabilities` for eligibility (lib/eligibleAgents.ts), not references to a
// skills/**/SKILL.md name. We validate their shape, not their existence.
//
// Exits non-zero on any error. Warnings do not change the exit code.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const agentsRoot = path.join(repoRoot, "agents");

const ALLOWED_KEYS = new Set([
  "name",
  "slug",
  "description",
  "created",
  "runtime",
  "model",
  "allowed-tools",
  "skills",
]);
const REQUIRED_KEYS = ["name", "slug", "description", "created"];
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

// Routing-health heuristic (warning only). A description that names no domain
// vocabulary routes poorly (ADR-007). Mirror the router's tokenizer/stopwords
// (lib/orchestrator/router.ts) and additionally drop lead-routing boilerplate,
// so "routes tasks to the right teammate" counts as zero domain terms.
const DESC_MIN_CHARS = 60;
const DESC_MIN_DOMAIN_TOKENS = 4;
const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "are", "was", "you",
  "your", "into", "about", "then", "them", "they", "have", "has", "not",
  "all", "any", "can", "will", "when", "what", "how", "use", "using",
]);
const ROUTING_BOILERPLATE = new Set([
  "routes", "route", "routing", "task", "tasks", "teammate", "teammates",
  "lead", "leads", "department", "departments", "right", "based", "skill",
  "skills", "overlap", "side",
]);

function domainTokens(text) {
  const tokens = new Set((text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []));
  for (const w of [...STOPWORDS, ...ROUTING_BOILERPLATE]) tokens.delete(w);
  return tokens;
}

function validate(file) {
  const errs = [];
  const warns = [];
  const stem = path.basename(file).replace(/\.md$/, "");
  const fm = matter(fs.readFileSync(file, "utf8")).data;

  for (const key of Object.keys(fm)) {
    if (!ALLOWED_KEYS.has(key)) {
      errs.push(`invalid frontmatter key "${key}" (allowed: ${[...ALLOWED_KEYS].join(", ")})`);
    }
  }
  for (const key of REQUIRED_KEYS) {
    if (fm[key] === undefined || fm[key] === null || fm[key] === "") {
      errs.push(`${key}: required`);
    }
  }

  if (typeof fm.slug === "string") {
    if (!SLUG_RE.test(fm.slug)) errs.push(`slug: must be kebab-case (got "${fm.slug}")`);
    if (fm.slug !== stem) errs.push(`slug "${fm.slug}" must match filename "${stem}"`);
  }

  if (typeof fm.description === "string") {
    if (fm.description.length > 1024) {
      errs.push(`description: ${fm.description.length} chars (max 1024)`);
    }
    if (/[<>]/.test(fm.description)) {
      errs.push("description: contains forbidden < or > chars");
    }
    if (fm.description.trim().length < DESC_MIN_CHARS || domainTokens(fm.description).size < DESC_MIN_DOMAIN_TOKENS) {
      warns.push("description: thin on domain vocabulary; routing scores against it (ADR-007)");
    }
  }

  if (fm.skills !== undefined) {
    if (!Array.isArray(fm.skills) || !fm.skills.every((s) => typeof s === "string" && SLUG_RE.test(s))) {
      errs.push("skills: must be a list of kebab-case capability tags");
    }
  }

  return { errs, warns };
}

function main() {
  const files = fs
    .readdirSync(agentsRoot, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "README.md" && e.name !== "CLAUDE.md")
    .map((e) => path.join(agentsRoot, e.name));

  let bad = 0;
  let warnCount = 0;
  for (const f of files) {
    const { errs, warns } = validate(f);
    const rel = path.relative(repoRoot, f);
    if (errs.length === 0) {
      console.log(`OK    ${rel}`);
    } else {
      bad++;
      console.error(`FAIL  ${rel}`);
      for (const e of errs) console.error(`        - ${e}`);
    }
    for (const w of warns) {
      warnCount++;
      console.error(`WARN  ${rel}`);
      console.error(`        - ${w}`);
    }
  }
  console.log(`\n${files.length} agent(s) checked, ${bad} failed, ${warnCount} warning(s).`);
  process.exit(bad === 0 ? 0 : 1);
}

main();
