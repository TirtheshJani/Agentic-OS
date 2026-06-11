# Memory

The Memory section provides a GUI for reading, creating, editing, and deleting Claude Code memory entries — replacing the need to edit raw JSON files by hand.

## How Claude Code uses memory

Claude Code writes persistent facts to JSON files in `~/.claude/memory/` (global) and `~/.claude/projects/<id>/memory/` (project-scoped). Claude reads these files at the start of each session to maintain continuity across conversations.

## Memory RAG (Retrieval-Augmented Generation)

Claude Control Center includes a sophisticated RAG system powered by **LightRAG**, which allows Claude to search through a vast amount of unstructured information during a session.

### How it works
The RAG system extracts entities and relationships from your memory entries and ingested sources (like Obsidian notes), creating a searchable knowledge graph.

### Capabilities
- **Knowledge Retrieval**: Claude can query the RAG index to find relevant context that might not be in the current session's short-term memory.
- **Obsidian Sync**: You can ingest entire Obsidian vaults into the RAG index (see [Obsidian Integration](./obsidian.md)).
- **Tagging & Filtering**: Sources in the RAG index are tagged, allowing for scoped retrieval.

### Configuration
Requires an `ANTHROPIC_API_KEY`. The RAG system uses `claude-haiku-4-5` for entity extraction and local `sentence-transformers` for embeddings. You can manage the daily budget and working directory in `backend/.env`.

---

## Memory scopes

**Global memory** (`/memory`) — entries that apply to all Claude Code sessions regardless of project. Useful for preferences like coding style, preferred tools, and personal conventions.

**Project memory** (`/memory/:projectId`) — entries scoped to a specific project. Useful for project-specific patterns, team conventions, or context that only matters within one codebase.

## Managing entries

### Create

Click **New Entry** on either the global or project memory page. Enter the content and select a type. The entry is written immediately to the appropriate JSON file.

### Edit

Click any memory card to open the inline editor. Changes are saved when you click **Save**. The file is written atomically using a temporary file rename to prevent corruption during partial writes.

### Delete

Click the delete icon on a memory card. The entry is removed from the JSON file. This action is permanent.

## Entry types

Memory entries have a `type` field used for visual grouping:

| Type | Displayed as |
|---|---|
| `preference` | Blue chip |
| `fact` | Grey chip |
| `instruction` | Orange chip |
| `context` | Purple chip |

The type field is informational and does not change how Claude reads the memory.

## Live updates

If Claude Code writes new memory entries while the dashboard is open, the memory pages do not auto-refresh. Reload the page to pick up external changes. The SSE stream emits `memory_update` events when memory files change, which triggers a React Query cache invalidation.
