---
name: repo-onboarding
description: Explore a repository (local path or GitHub URL), read its structure and key files, and write an onboarding document covering build/test commands, key abstractions, contribution patterns, and good first issues. Use when asked to "onboard me to this repo", "explain this codebase", "generate CLAUDE.md for this repo", "first-look at a repo", "document this codebase", or "create a repo guide".
license: MIT
allowed-tools: Read Bash
metadata:
  status: authored
  domain: coding
  mode: local
  mcp-server: github
  external-apis: []
  outputs: [vault/wiki/coding/onboarding-<repo>.md]
---

# Repo Onboarding

Reads a repository and produces a structured onboarding document. Works
with local repos (file reads) and GitHub repos (GitHub MCP).

Uses the **sequential workflow** pattern: discover structure → read key
files → identify patterns → synthesize.

## References

- `references/services/github.md` — `get_file_contents` decodes base64
  for large files; prefer specific tools over search; write ops are not
  authorized.

## Instructions

### Step 1: Determine the target repo

If the user provided:
- **A local path** → use `Read` and `Bash` tools to explore.
- **A GitHub URL** (e.g. `github.com/owner/repo`) → use GitHub MCP tools.
- **Neither** → ask for the path or URL before proceeding.

Extract `repo_slug` = the repo's base name (e.g. `agentic-os`).

### Step 2: Map the top-level structure

**Local:**
```bash
ls -la <path>
```

**GitHub:**
Use `list_directory_contents` or `get_file_contents` on the root path.

Look for and note the presence/absence of:
- `README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`
- `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`
- `Makefile`, `Justfile`, `.github/workflows/`
- `src/`, `lib/`, `app/`, `tests/`, `docs/`
- `.env.example`, `docker-compose.yml`

### Step 3: Read the key documentation files

Read in this order (skip if absent):
1. `README.md` — project overview, install, quickstart
2. `CLAUDE.md` or `AGENTS.md` — AI coding context (read verbatim if present)
3. `CONTRIBUTING.md` — PR/commit conventions
4. Top-level config file (`package.json` / `pyproject.toml` / etc.) — deps, scripts, version

### Step 4: Identify build and test commands

From the config file and README, extract:
- **Install:** `npm install`, `pip install -e .`, `cargo build`, etc.
- **Dev server:** `npm run dev`, `python -m uvicorn ...`, etc.
- **Test:** `npm test`, `pytest`, `cargo test`, `go test ./...`
- **Lint:** `npm run lint`, `ruff check .`, `golangci-lint run`
- **Build:** `npm run build`, `python -m build`, etc.

If commands are not explicit in docs, infer from scripts/Makefile targets.

### Step 5: Identify key abstractions

Read 3–5 of the most central source files. Prioritize:
- Entry points (`main.py`, `index.ts`, `main.go`, `App.tsx`)
- Core modules mentioned most in the README
- Files with the most imports from other files (indicates centrality)

For each file read, note:
- Its role in the system
- Key functions/classes/types it exports
- Dependencies it pulls in

Do not read every file. Stop after understanding the main data flow.

### Step 6: Check for open issues (GitHub only)

If using GitHub MCP and the repo is public:
```
search_issues is:open label:"good first issue" repo:<owner>/<repo>
```

List up to 5 good first issues with title and issue number.

### Step 7: Write the onboarding document

Write to `vault/wiki/coding/onboarding-<repo_slug>.md`:

```markdown
---
domain: coding
source: repo-onboarding
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: [<language>, <framework>, onboarding]
---

# <Repo Name> Onboarding

## What it is
[1–2 sentence description from README]

## Quick Start
\`\`\`bash
# Install
<install command>

# Run dev
<dev command>

# Run tests
<test command>
\`\`\`

## Key Commands
| Command | Purpose |
|---|---|
| `<command>` | <purpose> |

## Architecture
[3–5 sentences on the main data flow and layering]

## Key Files
| File | Role |
|---|---|
| `<path>` | <role> |

## Conventions
- Commit style: [conventional commits / descriptive / etc.]
- Branch naming: [feature/, fix/, etc.]
- PR process: [from CONTRIBUTING.md]

## Good First Issues
[numbered list if GitHub; otherwise "see repo issue tracker"]

## Notes
[any gotchas, non-obvious setup steps, or environment requirements]
```

Report the output path to the user. If this is a local repo, also ask
whether to write a `CLAUDE.md` directly into the repo root.

## Inputs

| Input | Description |
|---|---|
| Repo path or URL | Local filesystem path or `github.com/owner/repo` |

## Outputs

`vault/wiki/coding/onboarding-<repo>.md` — structured onboarding doc.

Optionally: `<repo-path>/CLAUDE.md` if the user confirms.

## Examples

**Local repo:**
> "Onboard me to this codebase"
→ Reads from the current working directory.

**GitHub URL:**
> "First-look at github.com/anthropics/anthropic-sdk-python"
→ Uses GitHub MCP to fetch structure and key files.

**Generate CLAUDE.md:**
> "Generate CLAUDE.md for this repo"
→ Runs the full onboarding, then asks whether to write CLAUDE.md.

## Troubleshooting

**GitHub 403 on private repo:** The GitHub MCP is scoped to read-only on
configured repos. For an unconfigured private repo, onboard from a local
clone instead.

**Large monorepo:** Focus on the subdirectory the user cares about rather
than the full repo root. Ask the user to specify if unclear.

**No README:** Ask the user for a 2-sentence description to anchor the doc,
then derive everything else from file structure and config.
