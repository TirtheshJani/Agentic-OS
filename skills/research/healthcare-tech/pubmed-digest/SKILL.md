---
name: pubmed-digest
description: Run a PubMed query for a condition, intervention, or methodology and write a structured digest with study designs, sample sizes, and effect sizes to vault/wiki/research/healthcare-tech/. Use when the user asks for "pubmed search on X", "medical literature on X", "recent studies on X".
license: MIT
metadata:
  status: stub
  domain: research/healthcare-tech
  mode: remote
  mcp-server: none
  external-apis: [pubmed]
  outputs: [vault/wiki/research/healthcare-tech/<query-slug>.md]
---

# pubmed-digest

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).
Pick one of the five orchestration patterns from standards/skill-authoring.md
(sequential / multi-MCP / iterative refinement / context-aware tool selection
/ domain-specific intelligence) and structure the body around it.

## Inputs
TODO

## Outputs
- vault/wiki/research/healthcare-tech/<query-slug>.md

## Examples
TODO

## Troubleshooting
TODO
