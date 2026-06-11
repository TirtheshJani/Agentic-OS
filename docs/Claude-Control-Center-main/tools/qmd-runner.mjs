#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const shellLanguages = new Set(["sh", "bash", "shell", "zsh"]);

function usage() {
  console.error(`Usage:
  qmd list <file.qmd>
  qmd run <file.qmd> [block-name] [--dry-run]

Markdown command blocks must use fenced shell code blocks, for example:
  \`\`\`bash qmd:name=frontend-build cwd=frontend
  npm run build
  \`\`\`
`);
  process.exit(1);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "block";
}

function parseFenceMeta(raw = "") {
  const meta = {};
  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    if (!token.includes("=")) {
      continue;
    }

    const [key, ...rest] = token.split("=");
    meta[key.replace(/^qmd:/, "")] = rest.join("=").replace(/^['"]|['"]$/g, "");
  }
  return meta;
}

function parseFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  const lines = source.split(/\r?\n/);
  const blocks = [];

  let currentHeading = "";
  let inFence = false;
  let currentBlock = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!inFence && headingMatch) {
      currentHeading = headingMatch[2].trim();
      continue;
    }

    if (!inFence) {
      const startMatch = line.match(/^```([^\s`]+)(.*)$/);
      if (!startMatch) {
        continue;
      }

      const language = startMatch[1].trim().toLowerCase();
      if (!shellLanguages.has(language)) {
        continue;
      }

      const meta = parseFenceMeta(startMatch[2]);
      inFence = true;
      currentBlock = {
        language,
        meta,
        heading: currentHeading,
        commandLines: [],
        index: blocks.length + 1
      };
      continue;
    }

    if (line.trim() === "```") {
      const fallbackName = currentBlock.heading
        ? slugify(currentBlock.heading)
        : `block-${currentBlock.index}`;
      blocks.push({
        name: currentBlock.meta.name || fallbackName,
        cwd: currentBlock.meta.cwd || ".",
        heading: currentBlock.heading || "(no heading)",
        command: currentBlock.commandLines.join("\n").trim()
      });
      inFence = false;
      currentBlock = null;
      continue;
    }

    currentBlock.commandLines.push(line);
  }

  if (inFence) {
    throw new Error(`Unclosed code fence in ${absolutePath}`);
  }

  return { absolutePath, blocks };
}

function resolveCwd(filePath, cwdValue) {
  const fileDir = path.dirname(filePath);
  return path.resolve(fileDir, cwdValue);
}

function listBlocks(filePath) {
  const { absolutePath, blocks } = parseFile(filePath);
  console.log(`${path.relative(process.cwd(), absolutePath)}:`);

  for (const block of blocks) {
    console.log(`- ${block.name} [cwd=${block.cwd}] ${block.heading}`);
  }

  if (blocks.length === 0) {
    console.log("- no shell blocks found");
  }
}

function runBlocks(filePath, blockName, dryRun) {
  const { absolutePath, blocks } = parseFile(filePath);
  const selectedBlocks = blockName ? blocks.filter((block) => block.name === blockName) : blocks;

  if (selectedBlocks.length === 0) {
    throw new Error(`No block matched "${blockName}" in ${absolutePath}`);
  }

  for (const block of selectedBlocks) {
    const cwd = resolveCwd(absolutePath, block.cwd);
    console.log(`\n# ${block.name}`);
    console.log(`# cwd: ${path.relative(repoRoot, cwd) || "."}`);
    console.log(block.command);

    if (dryRun) {
      continue;
    }

    const result = spawnSync(block.command, {
      stdio: "inherit",
      shell: "/bin/bash",
      cwd
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

const [, , command, filePath, maybeBlock, ...rest] = process.argv;

if (!command || !filePath) {
  usage();
}

if (command === "list") {
  listBlocks(filePath);
} else if (command === "run") {
  const flags = [maybeBlock, ...rest].filter(Boolean);
  const dryRun = flags.includes("--dry-run");
  const blockName = flags.find((value) => value !== "--dry-run");
  runBlocks(filePath, blockName, dryRun);
} else {
  usage();
}
