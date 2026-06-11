# Spec 0022 — Learning tab (AI tutors)

**Status:** Shipped
**Owner:** TJ
**Date:** 2026-06-11
**Decision record:** ADR-018

Implementation follows the karpathy-guidelines skill.

## Context

TJ wants assignable AI tutors for ongoing study (math for QML, papers, spaced repetition) with durable progress in the vault — using infrastructure that already exists rather than a new chat surface.

## Decisions (ADR-018)

1. **Tutoring sessions are ordinary runs against a dedicated scratch repo.** `createWorktree` requires a git repo and `startRunForIssue` always makes one. Pointing the learning project at the Agentic-OS repo would copy the entire repo (vault included) per session, and a no-worktree "conversation run" mode would touch the core pipeline for one consumer. Instead `ensureScratchRepo()` auto-`git init`s `<workspaceRoot>/learning-scratch/` and `ensureLearningProject()` registers a `learning` dashboard project on it — worktrees become honest throwaway exercise space, and the existing RunTerminal is the chat UI.
2. **Tutors are plain agents.** Three seeds ship as ordinary `agents/*.md`: `socratic-tutor` (elicit-before-explain), `paper-coach` (section-by-section paper reading), `drill-sergeant` (SRS reviewer). Editable in the agent editor; no new agent machinery.
3. **Topics are vault folders.** `vault/learning/<topic>/` with `SYLLABUS.md` (frontmatter: title, tutor, created; body = goals checklist), `sessions/*.md` written by tutors via absolute path (the deep-research precedent), optional `srs.md` (plain "- Q: / A: / last-reviewed:" cards; **no SRS algorithm in the dashboard** — the drill agent's prompt does the scheduling judgment).
4. **Session = templated issue** (`learningSessionIssue` in `lib/issueTemplates.ts`) filed `status: queued, mode: sync` against the learning project, assigned to the syllabus's tutor. The operator joins the PTY from the issue board.

## Files

`lib/learning/topics.ts`, `agents/{socratic-tutor,paper-coach,drill-sergeant}.md`, routes `GET/POST /api/learning` + `POST /api/learning/[topic]/session` ({kind: tutor|srs-review}), views `/learning` (topic cards, create modal with agent dropdown) + `/learning/[topic]` (syllabus, session-log list from the vault index, start buttons). Nav entry.

## Tests

`tests/learningTopics.test.ts` — create/list/srs-flag/slug-guard, `ensureScratchRepo` idempotence with a real `git init`. Issue-template contract in `tests/issueTemplates.test.ts`.

## Limitations

- Session-log discovery relies on tutors following the absolute-path contract; label-matched issues remain visible on the board regardless.
- No spaced-repetition algorithm (deliberate); srs.md is a plain card list.
