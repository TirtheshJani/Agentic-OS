# CCC Memory MCP Server

stdio MCP server that exposes shared LightRAG memory to Claude Code, Codex CLI, and Gemini CLI.

## Tools

| Tool | Description |
|------|-------------|
| `search_memory` | Hybrid knowledge-graph + vector search over all ingested documents |
| `add_memory` | Insert a new document into the shared RAG store |
| `list_memories` | List stored documents, filterable by source or tag |

## Setup

The server proxies all tool calls to the Flask API at `http://127.0.0.1:5050`. Start the CCC backend first.

```bash
cd mcp-memory-server
npm install
npm run build
```

### Claude Code
Add to `~/.claude/.claude.json`:
```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/abs/path/to/mcp-memory-server/dist/index.js"],
      "env": { "CCC_BASE_URL": "http://127.0.0.1:5050" }
    }
  }
}
```

Or use the CCC UI → MCP Servers → Memory MCP Bridge → Install.

## Environment

| Var | Default | Description |
|-----|---------|-------------|
| `CCC_BASE_URL` | `http://127.0.0.1:5050` | CCC Flask API base URL |
