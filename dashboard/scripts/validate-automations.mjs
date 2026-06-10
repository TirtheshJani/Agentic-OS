#!/usr/bin/env node
// Validate every automations/remote/*.md spec.
// Asserts: cron is parseable; skill name references an existing SKILL.md;
// filename matches <skill>-<cadence>.md; optional project/agent keys resolve
// to an existing vault project and agent profile (the in-dashboard scheduler
// needs project: to file issues, agent: to pre-assign them).
//
// Exits non-zero on any violation.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { CronExpressionParser } from "cron-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const remoteDir = path.join(repoRoot, "automations", "remote");
const skillsRoot = path.join(repoRoot, "skills");
const projectsRoot = path.join(repoRoot, "vault", "projects");
const agentsRoot = path.join(repoRoot, "agents");

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
  const base = path.basename(file);
  const raw = fs.readFileSync(file, "utf8");
  const fm = matter(raw).data;

  if (!fm.schedule) errs.push("missing required field: schedule");
  if (!fm.skill) errs.push("missing required field: skill");

  if (typeof fm.schedule === "string") {
    try {
      CronExpressionParser.parse(fm.schedule);
    } catch (e) {
      errs.push(`schedule: invalid cron "${fm.schedule}" (${e.message})`);
    }
  }

  if (typeof fm.skill === "string") {
    if (!skillNames.has(fm.skill)) {
      errs.push(`skill: "${fm.skill}" not found in skills/**/SKILL.md`);
    }
    const stem = base.replace(/\.md$/, "");
    if (!stem.startsWith(fm.skill + "-")) {
      errs.push(
        `filename "${base}" must start with "${fm.skill}-" (per standards/automation-authoring.md)`
      );
    }
  }

  if (fm.project !== undefined) {
    if (typeof fm.project !== "string" || !fm.project) {
      errs.push("project: must be a non-empty string when present");
    } else if (!fs.existsSync(path.join(projectsRoot, fm.project, "PROJECT.md"))) {
      errs.push(`project: "${fm.project}" has no vault/projects/${fm.project}/PROJECT.md`);
    }
  }

  if (fm.agent !== undefined) {
    if (typeof fm.agent !== "string" || !fm.agent) {
      errs.push("agent: must be a non-empty string when present");
    } else if (!fs.existsSync(path.join(agentsRoot, `${fm.agent}.md`))) {
      errs.push(`agent: "${fm.agent}" has no agents/${fm.agent}.md`);
    }
  }

  return errs;
}

function main() {
  const skillNames = collectSkillNames();
  const entries = fs
    .readdirSync(remoteDir, { withFileTypes: true })
    .filter(
      (e) => e.isFile() && e.name.endsWith(".md") && e.name !== "README.md"
    );
  let bad = 0;
  for (const e of entries) {
    const full = path.join(remoteDir, e.name);
    const rel = path.relative(repoRoot, full);
    const errs = validate(full, skillNames);
    if (errs.length === 0) {
      console.log(`OK    ${rel}`);
    } else {
      bad++;
      console.error(`FAIL  ${rel}`);
      for (const err of errs) console.error(`        - ${err}`);
    }
  }
  console.log(`\n${entries.length} spec(s) checked, ${bad} failed.`);
  process.exit(bad === 0 ? 0 : 1);
}

main();
