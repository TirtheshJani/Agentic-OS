---
name: content-research-writer
description: Writing partner for blog posts, newsletters, articles, case studies, and technical content. Conducts research, adds citations, sharpens hooks, gives section-by-section feedback, and preserves the user's voice. Use when the user is drafting long-form content and wants iterative feedback rather than a one-shot draft. Trigger phrases - "help me write", "review this section", "improve this hook", "add citations", "outline an article on X".
license: Apache-2.0
allowed-tools: Read, Write, Edit, WebFetch, WebSearch
metadata:
  status: authored
  domain: content
  mode: local
  mcp-server: none
  external-apis: []
  outputs: []
  source: https://github.com/ComposioHQ/awesome-claude-skills/tree/master/content-research-writer
  source-license: Apache-2.0
---

# Content Research Writer

Writing partner that researches, outlines, drafts, and refines content while preserving the user's voice. Operates iteratively, one section at a time, rather than one-shot.

## When to Use

- Blog posts, newsletters, articles
- Educational content or tutorials
- Thought leadership pieces
- Case studies, technical documentation
- Anything that needs proper citations, strong hooks, or section-by-section feedback

For the Agentic-OS content skills (`anxious-nomad`, `substack`, `community`), this provides the underlying review and research loop.

## Setup

```bash
mkdir -p vault/raw/drafts/<slug>
cd vault/raw/drafts/<slug>
touch draft.md research.md
```

Then run the workflow below from this folder.

## Instructions

### 1. Understand the project

Ask before starting:
- Topic and main argument
- Target audience
- Length and format
- Goal (educate, persuade, entertain, explain)
- Existing research or sources
- Voice (formal, conversational, technical)

If the user can show prior writing samples, read them first to internalize voice.

### 2. Collaborative outlining

Produce a structured outline before any prose. Use this skeleton:

```markdown
# Article Outline: <title>

## Hook
- <opening line / story / statistic>
- <why reader should care>

## Introduction
- Context
- Problem statement
- What this article covers

## Body sections
### <Section 1>
- Key point A
- Key point B
- Example or evidence
- [Research needed: <topic>]

## Conclusion
- Summary
- Call to action
- Final thought

## Research to-do
- [ ] <data on X>
- [ ] <example of Y>
- [ ] <source for Z>
```

Iterate on the outline before writing prose. Surface logical gaps, missing evidence, and weak transitions early.

### 3. Conduct research

When the user requests research:
- Search via WebFetch or WebSearch (or the `paper-search` / `research-lookup` skills if available)
- Pull credible sources (primary > academic > industry report > opinion)
- Extract facts, quotes, data with citations
- Append findings to `research.md` and link from the outline

Output template:

```markdown
## Research: <topic>

1. **<finding>** [1]
2. **<finding>** [2]
3. Expert quote: "..." - <name, affiliation> [3]

Citations:
[1] <Author>. (<year>). "<title>". <publication>.
[2] ...
```

### 4. Improve hooks

When user shares an introduction:
1. Diagnose what works and what is weak
2. Offer 3 alternatives, each with a brief "why it works"
3. Vary the levers: bold claim, question, story, data
4. Ask: does it create curiosity? promise value? feel specific? match the audience?

### 5. Section-by-section feedback

After each section, return:

```markdown
# Feedback: <section name>

## What works
- <strength 1>
- <strength 2>

## Suggestions
### Clarity
- <issue> then <fix>
### Flow
- <issue> then <fix>
### Evidence
- <claim needing support> then <add citation>
### Style
- <tone issue> then <adjustment>

## Line edits
Original: > "..."
Suggested: > "..."
Why: <reason>
```

Keep feedback specific. Never write vague reactions like "this is good" without naming what.

### 6. Preserve the user's voice

- Suggest, do not replace. Offer options.
- Match tone exactly. Formal stays formal, casual stays casual.
- If the user prefers their version, support it.
- Periodically ask: "does this sound like you?"

### 7. Citation management

Three styles, pick whichever the user prefers:

```markdown
# Inline
Studies show 40% productivity improvement (McKinsey, 2024).

# Numbered
Studies show 40% productivity improvement [1].
[1] McKinsey Global Institute. (2024). "..."

# Footnote
Studies show 40% productivity improvement^1
^1: McKinsey Global Institute. (2024). "..."
```

Maintain a running `## References` section.

### 8. Final review

When the draft is complete:

```markdown
# Full draft review

## Overall
- Strengths: <top 3>
- Impact: <assessment>

## Structure
- Organization, transitions, pacing

## Content
- Argument strength, evidence sufficiency, examples

## Technical
- Grammar, consistency, citation completeness

## Polish suggestions
1. Introduction: <specifics>
2. Body: <specifics>
3. Conclusion: <specifics>

## Pre-publish checklist
- [ ] All claims sourced
- [ ] Citations formatted
- [ ] Examples concrete
- [ ] Transitions smooth
- [ ] Call to action present
- [ ] Proofread
```

## Example: Hook improvement

**Original:**
> "Product management is changing because of AI. In this article, I'll discuss some ways AI affects product managers."

**Three alternatives:**

Option 1 (data-driven):
> "Last month, I asked AI to analyze 500 customer interviews. It took 30 minutes instead of 3 weeks. Product management will never be the same."

Option 2 (question):
> "What if you could talk to every customer, read every review, and analyze every support ticket, all before your morning coffee?"

Option 3 (story):
> "Sarah spent two weeks building the wrong feature. Not because she misunderstood her users, but because she could not process the hundreds of interviews fast enough to spot the pattern."

## Workflow variants

| Format          | Steps                                                        |
|-----------------|--------------------------------------------------------------|
| Blog post       | Outline, research, intro+feedback, body+feedback, conclusion, polish |
| Newsletter      | Hook ideas, short outline, draft in one session, link check, polish  |
| Tutorial        | Outline steps, code examples, explanations, test, troubleshoot, polish |
| Thought piece   | Unique angle, scan existing views, thesis, POV draft, evidence, conclusion |

## Best practices

- Verify sources before citing. Use recent data when possible.
- Balance perspectives. Link to originals.
- For feedback, be specific about what you want: "is this too technical?" beats "thoughts?"
- For voice, share samples and flag good matches as well as misses.

## Related skills

- `avoid-ai-writing` - run after drafting to strip AI patterns
- `paper-search`, `literature-review`, `research-lookup` - feed citations into step 3
- `substack`, `anxious-nomad`, `community` - downstream publishing skills
