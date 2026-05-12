---
name: requesting-code-review
description: "Use when completing tasks, implementing major features, or before merging to verify work meets requirements. Dispatches a code-reviewer subagent with precisely crafted context (no session history) to catch issues before they cascade. Part of the engineering team workflow between TDD and finishing-a-development-branch. Trigger phrases: 'review my code', 'request code review', 'check this before merging', 'dispatch a reviewer'."
license: MIT
allowed-tools: Bash, Read, Task
metadata:
  status: authored
  domain: engineering
  mode: local
  mcp-server: none
  external-apis: []
  outputs: []
  source: https://github.com/obra/superpowers
  source-license: MIT
  source-author: Jesse Vincent
---

# Requesting Code Review

Dispatch a code reviewer subagent to catch issues before they cascade. The reviewer gets precisely crafted context for evaluation, never your session's history. This keeps the reviewer focused on the work product, not your thought process, and preserves your own context for continued work.

**Core principle:** review early, review often.

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
- After completing a major feature
- Before merging to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing a complex bug

## How to Request

**1. Get git SHAs:**

```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch the code-reviewer subagent:**

Use the Task tool with `subagent_type="general-purpose"`. Fill in the template from `code-reviewer.md` in this skill folder.

**Placeholders:**
- `{DESCRIPTION}` - brief summary of what you built
- `{PLAN_OR_REQUIREMENTS}` - what it should do
- `{BASE_SHA}` - starting commit
- `{HEAD_SHA}` - ending commit

**3. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if the reviewer is wrong (with reasoning)

## Example

```
[Just completed Task 2: Add verification function]

You: Let me request code review before proceeding.

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch code reviewer subagent]
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types
  PLAN_OR_REQUIREMENTS: Task 2 from specs/2026-05-10-deployment-design.md
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661

[Subagent returns]:
  Strengths: Clean architecture, real tests
  Issues:
    Important: Missing progress indicators
    Minor: Magic number (100) for reporting interval
  Assessment: Ready to proceed

You: [Fix progress indicators]
[Continue to Task 3]
```

## Integration with Workflows

**Subagent-driven development:**
- Review after EACH task
- Catch issues before they compound
- Fix before moving to the next task

**Executing plans:**
- Review after each task or at natural checkpoints
- Get feedback, apply, continue

**Ad-hoc development:**
- Review before merge
- Review when stuck

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer is wrong:**
- Push back with technical reasoning
- Show code or tests that prove it works
- Request clarification

## Related skills

- `receiving-code-review` (in `engineering/`) - the counterpart for processing review feedback
- `test-driven-development` (in `engineering/`) - the step before review
- `finishing-a-development-branch` (in `engineering/`) - the step after review passes
- `karpathy-guidelines` (in `_meta/`) - the lens the reviewer should apply (YAGNI, surgical changes, no speculation)

Template lives in `code-reviewer.md` in this folder.
