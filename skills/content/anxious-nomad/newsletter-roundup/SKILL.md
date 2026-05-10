---
name: newsletter-roundup
description: Curate the week's links from vault/raw/ tagged for the newsletter, group thematically, and produce a roundup draft. Use when the user asks for "newsletter roundup", "weekly links", "anxious nomad newsletter".
license: MIT
metadata:
  status: stub
  domain: content/anxious-nomad
  mode: remote
  mcp-server: canva
  external-apis: [none]
  outputs: [vault/outputs/<YYYY-MM-DD>-newsletter.md]
---

# newsletter-roundup

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).
Pick one of the five orchestration patterns from standards/skill-authoring.md
(sequential / multi-MCP / iterative refinement / context-aware tool selection
/ domain-specific intelligence) and structure the body around it.

## MCP integrations
- Canva (`generate-design`, `export-design`): generate a cover image from
  the issue title once the draft sections are stable. Embed the exported
  PNG URL near the top of the draft. Use a `list-brand-kits` lookup once
  per session to honor the Anxious Nomad palette.

## Inputs
TODO

## Outputs
- vault/outputs/<YYYY-MM-DD>-newsletter.md

## Examples
TODO

## Troubleshooting
TODO
