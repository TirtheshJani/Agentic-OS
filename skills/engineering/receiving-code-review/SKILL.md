---
name: receiving-code-review
description: "Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable. Requires technical rigor and verification, not performative agreement or blind implementation. The counterpart to requesting-code-review in the engineering team workflow. Trigger phrases: 'reviewer said X', 'PR feedback', 'address comments', 'fix the review issues'."
license: MIT
allowed-tools: Bash, Read, Edit, Grep, Glob
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

# Receiving Code Review

## Overview

Code review requires technical evaluation, not emotional performance.

**Core principle:** verify before implementing. Ask before assuming. Technical correctness over social comfort.

## The Response Pattern

```
WHEN receiving code review feedback:

1. READ: complete feedback without reacting
2. UNDERSTAND: restate the requirement in your own words (or ask)
3. VERIFY: check against codebase reality
4. EVALUATE: is it technically sound for THIS codebase?
5. RESPOND: technical acknowledgment or reasoned pushback
6. IMPLEMENT: one item at a time, test each
```

## Forbidden Responses

**NEVER:**
- "You're absolutely right!"
- "Great point!" or "Excellent feedback!"
- "Let me implement that now" (before verification)
- Any expression of gratitude before action

**INSTEAD:**
- Restate the technical requirement
- Ask clarifying questions
- Push back with technical reasoning if wrong
- Just start working (actions over words)

## Handling Unclear Feedback

```
IF any item is unclear:
  STOP. Do not implement anything yet.
  ASK for clarification on the unclear items.

WHY: items may be related. Partial understanding = wrong implementation.
```

**Example:**

```
Reviewer: "Fix 1-6"
You understand 1, 2, 3, 6. Unclear on 4, 5.

WRONG: implement 1, 2, 3, 6 now, ask about 4, 5 later
RIGHT: "I understand items 1, 2, 3, 6. Need clarification on 4 and 5 before proceeding."
```

## Source-Specific Handling

### From the user
- Trusted. Implement after understanding.
- Still ask if scope is unclear.
- No performative agreement.
- Skip to action or technical acknowledgment.

### From external reviewers

```
BEFORE implementing:
  1. Check: technically correct for THIS codebase?
  2. Check: breaks existing functionality?
  3. Check: reason for current implementation?
  4. Check: works on all platforms/versions?
  5. Check: does reviewer understand full context?

IF suggestion seems wrong:
  Push back with technical reasoning.

IF you can't easily verify:
  Say so: "I can't verify this without [X]. Should I [investigate/ask/proceed]?"

IF conflicts with prior user decisions:
  Stop and discuss with the user first.
```

**Rule of thumb:** external feedback should be evaluated, not blindly followed. Be skeptical, but check carefully.

## YAGNI Check for "Professional" Features

```
IF reviewer suggests "implementing properly":
  grep the codebase for actual usage.

  IF unused: "This endpoint isn't called. Remove it (YAGNI)?"
  IF used: then implement properly.
```

If the codebase doesn't need a feature, don't add it. Both you and the reviewer report to the user; defer to their needs.

## Implementation Order

```
FOR multi-item feedback:
  1. Clarify anything unclear FIRST
  2. Then implement in this order:
     - Blocking issues (breaks, security)
     - Simple fixes (typos, imports)
     - Complex fixes (refactoring, logic)
  3. Test each fix individually
  4. Verify no regressions
```

## When to Push Back

Push back when:
- Suggestion breaks existing functionality
- Reviewer lacks full context
- Violates YAGNI (unused feature)
- Technically incorrect for this stack
- Legacy or compatibility reasons exist
- Conflicts with prior architectural decisions

**How to push back:**
- Use technical reasoning, not defensiveness
- Ask specific questions
- Reference working tests or code
- Involve the user if architectural

## Acknowledging Correct Feedback

When feedback IS correct:

```
GOOD:
- "Fixed. [Brief description of what changed]"
- "Good catch: [specific issue]. Fixed in [location]."
- [Just fix it and show the diff]

BAD:
- "You're absolutely right!"
- "Great point!"
- "Thanks for catching that!"
- "Thanks for [anything]"
- ANY gratitude expression
```

**Why no thanks:** actions speak. Just fix it. The code itself shows you heard the feedback.

**If you catch yourself about to write "Thanks":** delete it. State the fix instead.

## Gracefully Correcting Your Pushback

If you pushed back and were wrong:

```
GOOD:
- "You were right. I checked [X] and it does [Y]. Implementing now."
- "Verified this and you're correct. My initial understanding was wrong because [reason]. Fixing."

BAD:
- Long apology
- Defending why you pushed back
- Over-explaining
```

State the correction factually and move on.

## Common Mistakes

| Mistake                          | Fix                                                  |
|----------------------------------|------------------------------------------------------|
| Performative agreement           | State requirement or just act                        |
| Blind implementation             | Verify against codebase first                        |
| Batch without testing            | One at a time, test each                             |
| Assuming reviewer is right       | Check if it breaks things                            |
| Avoiding pushback                | Technical correctness over comfort                   |
| Partial implementation           | Clarify all items first                              |
| Can't verify, proceed anyway     | State limitation, ask for direction                  |

## Real Examples

**Performative agreement (bad):**

```
Reviewer: "Remove legacy code"
WRONG: "You're absolutely right! Let me remove that..."
```

**Technical verification (good):**

```
Reviewer: "Remove legacy code"
RIGHT: "Checking. Build target is 10.15+, this API needs 13+. Need legacy for backward compat. Current impl has wrong bundle ID. Fix it or drop pre-13 support?"
```

**YAGNI (good):**

```
Reviewer: "Implement proper metrics tracking with database, date filters, CSV export"
RIGHT: "Grepped codebase. Nothing calls this endpoint. Remove it (YAGNI)? Or is there usage I'm missing?"
```

**Unclear item (good):**

```
User: "Fix items 1-6"
You understand 1, 2, 3, 6. Unclear on 4, 5.
RIGHT: "Understand 1, 2, 3, 6. Need clarification on 4 and 5 before implementing."
```

## GitHub Thread Replies

When replying to inline review comments on GitHub, reply in the comment thread (`gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`), not as a top-level PR comment.

## The Bottom Line

**External feedback is suggestions to evaluate, not orders to follow.**

Verify. Question. Then implement.

No performative agreement. Technical rigor always.

## Related skills

- `requesting-code-review` (in `engineering/`) - the counterpart that dispatches the reviewer
- `karpathy-guidelines` (in `_meta/`) - the lens for evaluating "implement properly" suggestions
- `systematic-debugging` (in `_meta/`) - when reviewer flags a bug, investigate before fixing
- `verification-before-completion` (in `_meta/`) - run after addressing review issues
