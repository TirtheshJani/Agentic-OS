---
name: pr-review-prep
description: Given a GitHub PR URL, fetch the diff, files changed, and CI status via the GitHub MCP, then prepare a review checklist with hot-spots and questions. Use when the user asks to "prep PR [url]", "review this PR", "what should I look at in [pr]".
license: MIT
metadata:
  status: stub
  domain: coding
  mode: remote
  mcp-server: github
  external-apis: [none]
  outputs: [vault/wiki/coding/pr-<repo>-<num>.md]
---

# pr-review-prep

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).
Pick one of the five orchestration patterns from standards/skill-authoring.md
(sequential / multi-MCP / iterative refinement / context-aware tool selection
/ domain-specific intelligence) and structure the body around it.

## Inputs
TODO

## Outputs
- vault/wiki/coding/pr-<repo>-<num>.md

## Examples
TODO

## Troubleshooting
TODO
