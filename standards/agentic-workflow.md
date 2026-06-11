# Standard Operating Procedure: The Agentic Workflow

This SOP governs how all features are built in Agentic-OS, whether by the operator, by Claude Code interactively, or by agents dispatched from the dashboard. It formalizes a strict, repeatable framework: AI as an orchestrated engineering resource, not a conversational assistant.

## 1. Core philosophy

Agents hallucinate when given broad, horizontally layered tasks. They succeed when given thin, vertically integrated, and independently verifiable tasks. Every rule below exists to produce that shape of work.

## 2. The vertical slice (tracer bullets)

Never assign an agent to build "the database layer" or "the API." Slice work into **tracer bullets**: minimal, end-to-end features that cut through the UI, the API, and the database simultaneously, each independently testable.

## 3. The development lifecycle

A strict five-step procedural loop replaces ad-hoc prompting.

### Step 1: Research and prototype (`/prototype`)

Before committing to an architecture, validate the risky part in a throwaway sandbox session (e.g. a new dashboard React component's state model). Discard the code; keep the learnings for the spec.

### Step 2: The grill session (`/grill-me` or `/grill-with-docs`)

Never start coding from a vague idea. Force the AI to interview you: extract hidden assumptions, clarify business logic, establish domain vocabulary. Use `/grill-with-docs` when the design touches domain docs (CONTEXT.md, ADRs) so they are updated inline.

Goal: exact vocabulary the agents must use, and edge cases handled before any code exists.

### Step 3: Draft the specification (`/to-prd`)

Translate the grill output into a formal spec saved at `specs/NNNN-feature-name.md` (next free number). Required sections: business context, implementation path, domain vocabulary, and **alternatives considered** (rejected approaches, so agents do not attempt dead-end solutions). See the template in section 4A.

### Step 4: Slice into tracer bullets (`/to-issues`)

Break the spec into vertical slices filed on the kanban board. Every issue declares its execution type:

- **[AFK]** (autonomous): the agent writes the tests, implements, and verifies without human input.
- **[HITL]** (human-in-the-loop): the agent must pause for a visual UI review or a major architectural decision.

Each issue must carry strict, verifiable acceptance criteria. See the template in section 4B.

### Step 5: Test-driven implementation (`/tdd`)

TDD is the agent's localized compass against drift. Hand AFK issues to the coding agent with strict TDD instructions (the `.claude/commands/tdd-loop.md` prompt):

1. Write a failing Vitest test in `dashboard/tests/` describing the behavior.
2. Run `npx vitest run` and read the failure (Red).
3. Write the minimum code to pass that test (Green).
4. Re-run the suite.
5. Pause and ask permission to refactor.

## 4. Standardized templates

### A. Feature spec template (`specs/NNNN-feature-name.md`)

```markdown
# Feature: [Feature Name]

## 1. Business Context
[Explain the user problem this solves.]

## 2. Implementation Path
- Architecture: [Define the modules involved.]
- Data Flow: [Explain how data moves from DB to UI.]

## 3. Domain Vocabulary
[List terms the AI MUST use to maintain consistency.]

## 4. Alternatives Considered
[List approaches rejected during the grill session and why.]
```

### B. Issue template

```markdown
## Parent Feature
Reference: `specs/NNNN-feature-name.md`

## Vertical Slice Definition
[End-to-end functionality of this specific tracer bullet.]

## Execution Type
- [ ] AFK (Autonomous)
- [ ] HITL (Human-in-the-Loop)

## Acceptance Criteria
- [ ] Criteria 1 (e.g., database migration runs)
- [ ] Criteria 2 (e.g., API endpoint returns 201)
- [ ] Criteria 3 (e.g., dashboard UI reflects state change)
```

### C. TDD agent prompt

Lives at `.claude/commands/tdd-loop.md`; invoke as `/tdd-loop` with an issue reference.

## 5. Daily integration

This workflow plugs into existing routines: when reviewing the output of overnight AFK tasks (e.g. after `automations/local/morning-scan.sh`), the operator's role is reviewing architectural decisions and test coverage, not writing boilerplate.

## 6. Where the skills live

`/grill-me`, `/grill-with-docs`, `/prototype`, `/to-prd`, `/to-issues`, and `/tdd` are vendored from mattpocock/skills into `skills/_meta/` (provenance in ADR-004). All engineering agents list them in their `skills:` frontmatter; their system prompts instruct them to grill before non-trivial implementation and to use the TDD loop on AFK issues.
