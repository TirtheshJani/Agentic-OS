---
name: healthcare-arxiv
description: Pull arXiv submissions in q-bio and physics.med-ph categories, filter for healthcare-tech relevance, summarize, and write to vault/wiki/research/healthcare-tech/. Use when the user asks for "healthcare arxiv", "q-bio digest", "medical AI papers today".
license: MIT
metadata:
  status: stub
  domain: research/healthcare-tech
  mode: remote
  mcp-server: none
  external-apis: [arxiv]
  outputs: [vault/wiki/research/healthcare-tech/arxiv-YYYY-MM-DD.md]
---

# healthcare-arxiv

## References
- `references/services/arxiv.md` — endpoint, 3-second rate limit, ID
  extraction, today vs. yesterday batch.
- `scripts/validators/validate_arxiv_atom.py` — confirm response
  shape before iterating.

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).
Pick one of the five orchestration patterns from standards/skill-authoring.md
(sequential / multi-MCP / iterative refinement / context-aware tool selection
/ domain-specific intelligence) and structure the body around it.

## Inputs
TODO

## Outputs
- vault/wiki/research/healthcare-tech/arxiv-YYYY-MM-DD.md

## Examples
TODO

## Troubleshooting
TODO
