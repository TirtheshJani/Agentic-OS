---
name: research-lead
description: Routes research tasks to the right teammate based on skill overlap. Lead of the research department.
model: opus
department: research
role: lead
allowed-skills:
  - paper-search
  - literature-review
  - deep-web-research
allowed-tools: "Read Write Glob Grep WebFetch WebSearch"
system-prompt: ../_prompts/research-lead.md
---

# Research lead

This agent's behavior is defined by the linked system prompt. The skill body lives in
`skills/research/research-lead/SKILL.md`. This profile only configures the
spawning context (model, skill allowlist, tool grants).
