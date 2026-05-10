---
name: draft-from-vault
description: Read recent vault/wiki/ entries on a topic the user names, draft a Substack post using the standard post template at assets/post-template.md, and write the draft to vault/outputs/. Use when the user asks for "draft a substack post on X", "turn my notes on X into a post", "newsletter draft for X".
license: MIT
metadata:
  status: stub
  domain: content/substack
  mode: remote
  mcp-server: canva
  external-apis: [none]
  outputs: [vault/outputs/<YYYY-MM-DD>-substack-<slug>.md]
---

# draft-from-vault

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).
Pick one of the five orchestration patterns from standards/skill-authoring.md
(sequential / multi-MCP / iterative refinement / context-aware tool selection
/ domain-specific intelligence) and structure the body around it.

## MCP integrations
- Canva (`generate-design`, `export-design`): optional hero image for the
  post. Generate once the title is committed; export PNG; place URL in
  the draft frontmatter as `cover_image`. Skip if the user passes
  `--no-image`.

## Inputs
TODO

## Outputs
- vault/outputs/<YYYY-MM-DD>-substack-<slug>.md

## Examples
TODO

## Troubleshooting
TODO
