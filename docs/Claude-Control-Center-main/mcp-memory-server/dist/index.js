#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const client_js_1 = require("./client.js");
const TOOLS = [
    {
        name: "search_memory",
        description: "Search the shared agentic memory (LightRAG knowledge graph). Returns relevant context from plans, conversations, Obsidian notes, and research.",
        inputSchema: {
            type: "object",
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
        description: "Add a new document to the shared agentic memory for future retrieval by any agent.",
        inputSchema: {
            type: "object",
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
        description: "List documents in the shared memory, optionally filtered by source or tag.",
        inputSchema: {
            type: "object",
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
const server = new index_js_1.Server({ name: "ccc-memory", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        let result;
        if (name === "search_memory") {
            const { query, mode = "hybrid", top_k = 10 } = args;
            result = await (0, client_js_1.searchMemory)(query, mode, top_k);
        }
        else if (name === "add_memory") {
            const { content, source = "mcp", tags = [], doc_id } = args;
            result = await (0, client_js_1.addMemory)(content, source, tags, doc_id);
        }
        else if (name === "list_memories") {
            const { source, tag } = (args ?? {});
            result = await (0, client_js_1.listMemories)({ source, tag });
        }
        else {
            return {
                content: [{ type: "text", text: `Unknown tool: ${name}` }],
                isError: true,
            };
        }
        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
        };
    }
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    process.stderr.write("CCC Memory MCP server started\n");
}
main().catch((err) => {
    process.stderr.write(`Fatal: ${err}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map