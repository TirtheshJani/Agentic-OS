---
name: skill-seekers
description: Generate Agentic-OS skills from external documentation sites, GitHub repos, PDFs, videos, or codebases using the Skill Seekers framework. Use when the user wants to "create a skill for X library", "turn these docs into a skill", "scrape this repo into a skill", or onboard a new project framework that Claude does not already know. Requires Skill Seekers to be installed locally via pipx and its MCP server registered.
license: MIT
allowed-tools: Bash, Read, Write, WebFetch
metadata:
  status: authored
  domain: _meta
  mode: local
  mcp-server: skill-seekers
  external-apis: [anthropic-optional, github-optional]
  outputs: [skills/<domain>/<slug>/SKILL.md]
  source: https://github.com/yusufkaraaslan/Skill_Seekers
  source-license: MIT
  preconditions:
    - "pipx install skill-seekers"
    - "Skill Seekers MCP server registered in .mcp.json"
---

# Skill Seekers (Skill Generator)

Wraps the `yusufkaraaslan/Skill_Seekers` framework. Skill Seekers scrapes a knowledge source (docs site, repo, PDF, video, codebase) and emits a packaged Claude skill. This wrapper tells Claude when and how to invoke it from inside Agentic-OS.

## When to Use

Trigger when the user says any of:
- "build a skill for [framework/library/docs]"
- "turn the [X] docs into a skill"
- "scrape [repo] into a skill"
- "onboard [project] so Claude knows its API"
- "I want Claude to learn [framework]"

Especially relevant for the projects under `vault/projects/` where Claude has weak knowledge of the framework: GES UVES pipeline, FHIR resources, qml-essentials, surface-code QEC, etc.

## Preconditions (one-time setup)

Skill Seekers is a separate Python framework. Install once per machine:

```bash
pipx install skill-seekers
# Optional MCP server for richer tool surface (35 tools vs CLI)
git clone https://github.com/yusufkaraaslan/Skill_Seekers /tmp/skill-seekers
cd /tmp/skill-seekers && bash setup_mcp.sh
```

Then register its MCP server in `~/.claude.json` or `.mcp.json` (Skill Seekers ships a sample). After setup, `skill-seekers --version` should succeed.

If `pipx install skill-seekers` is not present, stop and surface the missing dependency to the user before doing anything else.

## Source Type Detection

Detect the source type from user input:

| Input pattern                           | Source type   | Subcommand            |
|-----------------------------------------|---------------|-----------------------|
| `https://...` (not GitHub/YouTube)      | Documentation | `scrape_docs`         |
| `owner/repo` or `github.com/...`        | GitHub repo   | `scrape_github`       |
| `*.pdf`                                 | PDF           | `scrape_pdf`          |
| YouTube or Vimeo URL                    | Video         | `scrape_video`        |
| Local directory path                    | Codebase      | `scrape_codebase`     |
| `*.ipynb`, `*.html`, OpenAPI YAML, etc. | Generic       | `scrape_generic`      |

## Workflow

1. **Confirm preconditions.** Run `skill-seekers doctor` and report status.
2. **Estimate scope.** For doc sites, call `skill-seekers estimate-pages <url>` so the user can confirm before a long scrape.
3. **Generate config.** `skill-seekers generate-config <source>` produces a JSON config under `configs/`.
4. **Scrape.** Run the appropriate `scrape_*` subcommand. Output lands in `output/<name>_data/`.
5. **Package.** `skill-seekers package output/<name> --target claude` produces a `.zip` bundle plus a SKILL.md.
6. **Adapt to Agentic-OS schema.** The packaged SKILL.md uses minimal frontmatter (`name`, `description` only). Before placing under `skills/<domain>/<slug>/`, add:
   - `license: <upstream license>`
   - `allowed-tools` (infer from the skill body)
   - `metadata` block with `status`, `domain`, `mode`, `mcp-server`, `external-apis`, `outputs`, `source`
   - Strip em dashes (U+2014 and U+2013) per repo convention
7. **Validate.** Run `cd dashboard && npm run validate:skills`. Fix any frontmatter errors before committing.
8. **Decide placement.** Use `skills/research/<project>/` for research projects, `skills/coding/<framework>/` for code frameworks, `skills/_meta/` for framework-level meta-skills.

## Example Invocations

**Scrape FHIR R5 spec into a skill:**
```bash
skill-seekers create https://hl7.org/fhir/R5/ --target claude --name fhir-r5
# then adapt output/fhir-r5/SKILL.md per step 6
```

**Scrape a private GitHub repo:**
```bash
export GITHUB_TOKEN=...
skill-seekers create owner/private-repo --target claude
```

**Scrape a paper PDF:**
```bash
skill-seekers create ./pecaut-mamajek-2013.pdf --target claude --name mk-bin-edges
```

## What Skill Seekers Does Not Do

- Does not write the Agentic-OS `metadata` block. Always step 6 by hand.
- Does not validate against `dashboard/scripts/validate-skills.mjs`. Always step 7.
- Does not detect duplicate skills already in `skills/`. Check first.
- Does not strip em dashes or other style rules.

## Related Skills

- `new-skill` (vendored skill-creator) - for hand-authoring a single skill from scratch when scraping is overkill
- `karpathy-guidelines` - apply to the generated SKILL.md before committing (trim, surface assumptions)
- `verification-before-completion` - run the validator before claiming the skill is installed

## Notes on the Upstream Framework

Skill Seekers is heavy: `anthropic`, `langchain`, `llama-index`, `PyMuPDF`, `Pillow`, `PyGithub`, `GitPython`, `httpx`, `beautifulsoup4`, `pydantic`. Optional API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) enable AI enhancement; without them, scraping still works but post-processing is dumber. For most Agentic-OS use cases the LOCAL mode (no API key) is sufficient because final SKILL.md authoring happens in this Claude Code session.
