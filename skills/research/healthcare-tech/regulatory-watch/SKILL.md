---
name: regulatory-watch
description: Pull the latest FDA and CE healthcare-tech regulatory updates from public RSS feeds, classify by device class and topic, and write a watch report to vault/wiki/research/healthcare-tech/. Use when the user asks for "regulatory update", "FDA news", "new device clearances".
license: MIT
metadata:
  status: stub
  domain: research/healthcare-tech
  mode: remote
  mcp-server: none
  external-apis: [fda-rss, ce-rss]
  outputs: [vault/wiki/research/healthcare-tech/regulatory-YYYY-MM-DD.md]
---

# regulatory-watch

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).
Pick one of the five orchestration patterns from standards/skill-authoring.md
(sequential / multi-MCP / iterative refinement / context-aware tool selection
/ domain-specific intelligence) and structure the body around it.

## Inputs
TODO

## Outputs
- vault/wiki/research/healthcare-tech/regulatory-YYYY-MM-DD.md

## Examples
TODO

## Troubleshooting
TODO
