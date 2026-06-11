#!/usr/bin/env python3
"""
MCP Memory Server — exposes LightRAG as tools for Claude Code, Codex, and Antigravity.

Tools:
  query_memory(query, mode?)  — search the shared knowledge graph
  add_memory(content, source?, tags?)  — insert new knowledge

Usage (add to ~/.claude/claude_desktop_config.json or similar):
  {
    "mcpServers": {
      "memory": {
        "command": "python3",
        "args": ["/path/to/backend/mcp_memory_server.py"],
        "env": {
          "LIGHTRAG_SERVER_URL": "http://localhost:9621",
          "CCC_BASE_URL": "http://127.0.0.1:5050"
        }
      }
    }
  }

The server proxies to the Control Center backend (/api/memory/rag/*) so all
budget tracking and manifest logic stays centralised.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
import urllib.error
from typing import Any

CCC_BASE_URL = os.getenv("CCC_BASE_URL", "http://127.0.0.1:5050").rstrip("/")
_TIMEOUT = 30


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _post(path: str, payload: dict) -> dict:
    url = f"{CCC_BASE_URL}{path}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        return json.loads(resp.read())


def _get(path: str) -> dict:
    url = f"{CCC_BASE_URL}{path}"
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        return json.loads(resp.read())


# ---------------------------------------------------------------------------
# MCP protocol (stdio JSON-RPC subset)
# ---------------------------------------------------------------------------

TOOLS = [
    {
        "name": "query_memory",
        "description": (
            "Search the shared LightRAG knowledge graph built from Claude Code, "
            "Codex, and Antigravity sessions. Returns relevant context as text."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Natural language query"},
                "mode": {
                    "type": "string",
                    "enum": ["hybrid", "local", "global", "naive", "mix"],
                    "default": "hybrid",
                    "description": "Retrieval mode",
                },
                "top_k": {
                    "type": "integer",
                    "default": 10,
                    "description": "Number of results to retrieve",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "add_memory",
        "description": (
            "Insert a piece of knowledge into the shared LightRAG memory. "
            "Use to save decisions, facts, or context for future sessions."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "Text to store"},
                "source": {
                    "type": "string",
                    "default": "manual",
                    "description": "Source label (e.g. 'claude-code', 'codex', 'antigravity')",
                },
                "tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional tags for filtering",
                },
            },
            "required": ["content"],
        },
    },
]


def _handle(method: str, params: dict) -> Any:
    if method == "initialize":
        return {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "ccc-memory", "version": "1.0.0"},
        }

    if method == "tools/list":
        return {"tools": TOOLS}

    if method == "tools/call":
        name = params.get("name")
        args = params.get("arguments", {})
        return _call_tool(name, args)

    return None


def _call_tool(name: str, args: dict) -> dict:
    try:
        if name == "query_memory":
            query = args.get("query", "")
            mode = args.get("mode", "hybrid")
            top_k = int(args.get("top_k", 10))
            result = _post("/api/memory/rag/search", {"query": query, "mode": mode, "top_k": top_k})
            text = result.get("answer") or result.get("result") or "No results found."
            return {"content": [{"type": "text", "text": text}]}

        if name == "add_memory":
            content = args.get("content", "")
            source = args.get("source", "manual")
            tags = args.get("tags", [])
            result = _post("/api/memory/rag/add", {"content": content, "source": source, "tags": tags})
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Stored in memory (doc_id: {result.get('doc_id', '?')})",
                    }
                ]
            }

        return {
            "content": [{"type": "text", "text": f"Unknown tool: {name}"}],
            "isError": True,
        }
    except Exception as e:
        return {
            "content": [{"type": "text", "text": f"Error: {e}"}],
            "isError": True,
        }


def main() -> None:
    for raw_line in sys.stdin:
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        try:
            msg = json.loads(raw_line)
        except json.JSONDecodeError:
            continue

        msg_id = msg.get("id")
        method = msg.get("method", "")
        params = msg.get("params", {})

        result = _handle(method, params)

        if msg_id is None:
            continue

        response: dict[str, Any] = {"jsonrpc": "2.0", "id": msg_id}
        if result is not None:
            response["result"] = result
        else:
            response["error"] = {"code": -32601, "message": f"Method not found: {method}"}

        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
