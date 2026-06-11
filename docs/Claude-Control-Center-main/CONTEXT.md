# Claude Control Center

A self-hosted dashboard over the user's local `~/.claude` and `~/.codex` directories. This glossary pins down terms that are otherwise overloaded across the codebase's many provider integrations.

## Language

**Conversation**:
A single Claude Code session, persisted as one JSONL file at `projects/<project>/<session>.jsonl`. Each line is a message. When unqualified, "conversation" means Claude Code specifically — Codex, Gemini, and Antigravity sessions are always named with their provider.
_Avoid_: Session (ambiguous across providers), chat, thread

**Memory**:
A canonical project-scoped markdown file at `projects/<project>/memory/*.md`, with frontmatter (`name`, `description`, `type`) and a body. This is the source of truth on disk. The LightRAG semantic index built from these files is the **RAG memory**, a derived artifact — never just "memory".
_Avoid_: RAG memory (that's the derived index), Codex/Gemini/Antigravity memory (always provider-qualified)

**Global Search**:
A keyword scan across Conversations and Memory (as defined above), returning ranked hits that deep-link back to the source message or file. Distinct from the per-domain client-side list filters that already exist on individual pages.
_Avoid_: Filter (that's the per-page in-memory narrowing), query
