---
name: paper-summary
description: Given an arXiv ID, DOI, or paper title, fetch metadata via Semantic Scholar, summarize the paper, and write a structured note to vault/wiki/research/physics-ml/. Use when the user asks to "summarize this paper", "explain arxiv 2401.XXXXX", "give me the gist of [paper]".
license: MIT
metadata:
  status: stub
  domain: research/physics-ml
  mode: remote
  mcp-server: none
  external-apis: [semantic-scholar, arxiv]
  outputs: [vault/wiki/research/physics-ml/<paper-slug>.md]
---

# paper-summary

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).
Pick one of the five orchestration patterns from standards/skill-authoring.md
(sequential / multi-MCP / iterative refinement / context-aware tool selection
/ domain-specific intelligence) and structure the body around it.

## References
- `../../../../references/services/arxiv.md` — endpoint, query
  patterns, response shape (used when an arXiv ID is the input).
- `../../../../scripts/validators/validate_arxiv_atom.py` —
  shape-checks a saved Atom response.

## Inputs
TODO

## Outputs
- vault/wiki/research/physics-ml/<paper-slug>.md

## Examples
TODO

## Troubleshooting
TODO
