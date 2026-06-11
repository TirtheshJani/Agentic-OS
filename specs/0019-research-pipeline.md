# Spec 0019 — Research tab + research-pipeline RAG

**Status:** Shipped
**Owner:** TJ
**Date:** 2026-06-11

Implementation follows the karpathy-guidelines skill.

## Context

TJ runs multi-source research (papers, web, video) and wants it organized like open-notebook's Notebook → Sources → Notes → Chat model: a research project with collected sources, freeform notes, and grounded chat — with collection done by agents, not by hand.

## Decisions

1. **Research projects are vault folders, not dashboard projects.** `vault/research/<slug>/` with `RESEARCH.md` (frontmatter: title, question, status open|active|synthesized|archived, created, tags), `sources/*.md` (provenance frontmatter: source-url, source-type web|youtube|reddit|paper, collected-by, collected-at), `notes/*.md`, optional `brief.md`. The vault indexer and spec-0013 chunking pick all of it up automatically — zero new index machinery, no migration.
2. **Collection runs through the agent-run pipeline, never the Next server.** Collectors (yt-dlp, Reddit, web) are credentialed, flaky, long-running subprocesses — exactly what PTY runs + the existing deep-research/research-lookup skills are for. The dashboard files a templated issue (`researchCollectionIssue` in `lib/issueTemplates.ts`) instructing the agent to write one source file per find, with the provenance contract, by absolute vault path; acceptance: ≥3 attributed sources.
3. **No settings block.** The collect endpoint defaults to a dashboard project slugged `research` and accepts `{projectSlug, agentSlug}` overrides in the body; a 409 with setup instructions explains the one-time project creation. (Deviation from the original plan's settings keys — simpler, no speculative configurability.)
4. **Per-source chat scoping** (open-notebook's context control): source/note checkboxes pass exact `includePaths` to the retrieval scope (`scope.paths` filter in `lib/rag/retrieval.ts`); unchecked = whole-project prefix scope.
5. **Brainstorm mode is nothing new** — freeform notes in `notes/` plus the scoped ask.

## Files

`lib/research/projects.ts` (folder CRUD, provenance parsing — unattributed sources surface with a badge instead of hiding), `lib/issueTemplates.ts` (shared with specs 0022/0023), routes `GET/POST /api/research`, `GET /api/research/[slug]`, `POST /api/research/[slug]/collect`, `POST /api/research/[slug]/ask`, views `/research` + `/research/[slug]` (sources with provenance + selection checkboxes, notes, grounded chat with retrieval disclosure, "Run collection" button with live status text).

## Tests

`tests/researchProjects.test.ts` (create/list/provenance/malformed-frontmatter/slug guards), `tests/issueTemplates.test.ts` (template contracts).

## Limitations

- The `research` dashboard project (scratch repo + research-capable agent) is a one-time manual setup; the 409 explains it.
- Collection quality is the skills' responsibility; the dashboard only files the issue and renders what lands.
