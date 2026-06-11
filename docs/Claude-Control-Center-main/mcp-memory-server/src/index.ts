#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { searchMemory, addMemory, listMemories } from "./client.js";

const TOOLS: Tool[] = [
  {
    name: "search_memory",
    description:
      "Search the shared agentic memory (LightRAG knowledge graph). Returns relevant context from plans, conversations, Obsidian notes, and research.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        mode: {
          type: "string",
          enum: ["hybrid", "local", "global"],
          description: "Search mode: hybrid (default), local (entity-centric), or global (community-centric)",
          default: "hybrid",
        },
        top_k: {
          type: "number",
          description: "Max results to return (default 10)",
          default: 10,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "add_memory",
    description:
      "Add a new document to the shared agentic memory for future retrieval by any agent.",
    inputSchema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "The content to store in memory",
        },
        source: {
          type: "string",
          description: "Source label (e.g. 'claude-code', 'codex', 'gemini', 'manual')",
          default: "mcp",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags for filtering",
          default: [],
        },
        doc_id: {
          type: "string",
          description: "Optional unique doc ID (for deduplication / updates)",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "list_memories",
    description:
      "List documents in the shared memory, optionally filtered by source or tag.",
    inputSchema: {
      type: "object" as const,
      properties: {
        source: {
          type: "string",
          description: "Filter by source label",
        },
        tag: {
          type: "string",
          description: "Filter by tag",
        },
      },
    },
  },
];

const server = new Server(
  { name: "ccc-memory", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    if (name === "search_memory") {
      const { query, mode = "hybrid", top_k = 10 } = args as {
        query: string;
        mode?: "hybrid" | "local" | "global";
        top_k?: number;
      };
      result = await searchMemory(query, mode, top_k);
    } else if (name === "add_memory") {
      const { content, source = "mcp", tags = [], doc_id } = args as {
        content: string;
        source?: string;
        tags?: string[];
        doc_id?: string;
      };
      result = await addMemory(content, source, tags, doc_id);
    } else if (name === "list_memories") {
      const { source, tag } = (args ?? {}) as { source?: string; tag?: string };
      result = await listMemories({ source, tag });
    } else {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("CCC Memory MCP server started\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
