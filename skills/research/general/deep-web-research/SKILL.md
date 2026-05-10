---
name: deep-web-research
description: Run a deep web research session on a given topic using Firecrawl for crawling and the Drive MCP for storing source PDFs/screenshots, then write a synthesis to vault/wiki/research/general/. Use when the user asks for "deep research on X", "comprehensive web research", "crawl and summarize sources for X", or "do a literature scan on X".
license: MIT
metadata:
  status: stub
  domain: research/general
  mode: remote
  mcp-server: drive
  external-apis: [firecrawl]
  outputs: [vault/wiki/research/general/<topic>.md]
---

# deep-web-research

## Instructions
TODO: fill in via /new-skill (which delegates to skills/_meta/skill-creator).
Pick one of the five orchestration patterns from standards/skill-authoring.md
(sequential / multi-MCP / iterative refinement / context-aware tool selection
/ domain-specific intelligence) and structure the body around it.

## Inputs
TODO

## Outputs
- vault/wiki/research/general/<topic>.md

## Examples
TODO

## Troubleshooting
TODO
