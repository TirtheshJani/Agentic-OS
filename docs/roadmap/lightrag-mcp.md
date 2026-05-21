# Roadmap: LightRAG MCP Integration

**Status:** Idea, not scoped. Target: after Path A Phases 1-7 land. Park here until then.

**Surface:** Agent-loop via MCP (chosen during brainstorm, May 2026).

## Why

Agents spawned by Agentic-OS today only see the worktree they're running in. They don't know what's in your reading notes, past Claude Code sessions, BPL archive, podcast research, or Substack drafts. You query LightRAG manually through its web UI, then paste relevant context into the issue body or thread by hand. The agent works from your transcription of what LightRAG returned, not from the source.

The integration removes you from that loop: agents query LightRAG directly when they need context, and you only see the query happen because it shows up in their output stream.

## Current state (May 2026)

LightRAG is running locally as a separate process. Default port 9621. The KB has roughly 500 nodes ingested across mixed content, verified visually from the dashboard screenshot: CLAUDE.md entries, Claude Code session transcripts, work documents like "Accounting Software" appearing as labels in the graph view. The web UI works for manual query; the REST API at `/api/...` is available for programmatic access.

Ingestion is manual through the LightRAG UI. The KB grows as you add documents but doesn't update automatically when new Agentic-OS threads or runs complete.

## Integration sketch

The simplest path uses an existing community MCP server that wraps the LightRAG API. Three options surfaced during the May 2026 brainstorm:

1. **daniel-lightrag-mcp** (Python, 22 tools across document management, querying, knowledge graph operations, system management). Most complete coverage of LightRAG's API. Production-ready based on community feedback. `pip install -e .` from the GitHub repo, configure with `LIGHTRAG_BASE_URL` env var.
2. **jeffreychuuu/lightrag_mcp** (Python, query-only focus). Simpler but less capable. Useful as a fallback if daniel's variant has issues.
3. **ricardo-kaminski/lightrag-mcp** (less documentation found; lower priority).

Recommend evaluating daniel-lightrag-mcp first. If it works and is reliable, no need to write a custom one. If it's missing a tool we need, fork it or write a thin Python MCP server with the official SDK (a few hundred lines).

Where the MCP config lives: each worktree that Agentic-OS creates already gets a `.claude/settings.local.json` written by the SessionStart hook installer (per Path A Phase 3, Task 4). The MCP server gets added to the same directory's `.claude/mcp.json`. Agents spawned in that worktree auto-discover it.

The dashboard's runtime layer (`dashboard/lib/runtime/claude-code.ts`) writes the MCP config at worktree creation time alongside the hook installer. Config points at the operator's existing LightRAG instance on `localhost:9621`. If LightRAG isn't running, the MCP server reports unavailable and the agent simply doesn't have that tool, no crash.

## Open questions for when we pick this up

**One global KB or per-project KBs?** LightRAG supports either pattern: multiple instances on different ports, or a single instance with document namespacing. Per-project KBs are tighter and avoid cross-project leakage (the QML agent shouldn't surface Roots of Reality notes mid-task), but require more operational overhead. A single KB with namespacing is simpler but agents need to know to filter. Default position: start with the existing single KB, add namespacing if leakage becomes a problem.

**What gets ingested automatically?** Candidates: completed agent runs (worktree diff plus thread events), Claude Code session transcripts (already JSONL in `~/.claude/projects/`), thread comments from the operator. Risk: indiscriminate ingestion pollutes the KB. Mitigation: opt-in per project via PROJECT.md frontmatter like `lightrag-ingest: true`.

**Ingestion plumbing.** If we want automatic ingestion, the dashboard needs a small worker that watches for `run.done` events and POSTs the relevant content to LightRAG. Or this stays manual via the LightRAG web UI and Agentic-OS just provides query access. Manual is the right starting point; automation can be added later if the friction becomes real.

**Two-way trust.** If an agent ingests a document into LightRAG mid-run, future runs will see it. Probably correct for some content (research notes the agent compiles), incorrect for others (intermediate scratch work). Maybe a tool naming convention: `lightrag_query` always available; `lightrag_insert` requires explicit permission per project, expressed in the agent's `allowed-tools` frontmatter.

**Per-issue vs per-project context.** When an agent on issue 42 queries LightRAG, should it get results scoped to the project, or to the whole KB? Most likely project-scoped via a filter, but until we use it we won't know if the broader sweep produces useful surprises.

## Smallest first slice

Once Path A Phase 3 lands and agents actually run end-to-end:

1. Install daniel-lightrag-mcp globally (`pip install -e .` from the repo, or whatever the install path is at that time).
2. Add the MCP config to one worktree by hand, point it at your existing LightRAG instance.
3. Start a real issue against a project that has indexed content (the QML project is a natural fit since the QML research papers are likely already in the KB by then). See if the agent uses the new tool. If it does, did it find anything useful?
4. If yes, automate the MCP config installation in `lib/runtime/claude-code.ts` so every new worktree gets it.

That's the entire MVP. No new schema, no new tables, no new dashboard UI. Just config installation plumbing and an existing community MCP server.

## Dependencies

- Path A Phase 3 complete: agents must actually run in worktrees with the claude-code runtime.
- LightRAG continues to be maintained and the chosen MCP server stays API-compatible.
- daniel-lightrag-mcp or chosen alternative remains functional. If it goes stale, the fallback is a forked or hand-written MCP server.

## When to revisit

Pick this up after the rebuild lands. Realistic earliest: post-Phase 7, once the second runtime (codex or gemini-cli) is in and the runtime registry has been exercised. The agent-loop value of LightRAG is highest when the runtime layer is stable; trying to integrate while runtime is still being refactored creates two moving targets.

If a high-value use case shows up sooner (e.g., you're in a QML literature review crunch and the value of LightRAG-in-agent is suddenly very tangible), bring it forward and treat the integration as a Phase 4 or 5 side-track. The smallest-first-slice is small enough to slot in.

## Related notes

The brainstorm in May 2026 also surfaced two non-MCP integration surfaces (pre-injection at issue creation, operator panel in dashboard) and chose MCP as the most ambitious option to ship first. If MCP turns out to be hard to land (e.g., daniel-lightrag-mcp has reliability issues, or the per-worktree MCP config approach proves messy), fall back to pre-injection: when an issue is created, the dashboard auto-queries LightRAG with the title and body, prepends the top-k chunks to the agent's initial prompt, agent doesn't know LightRAG exists. Less ambitious, much less surface area, can land in a single day.
