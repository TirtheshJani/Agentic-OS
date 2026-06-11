"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchMemory = searchMemory;
exports.addMemory = addMemory;
exports.listMemories = listMemories;
exports.getMemoryStatus = getMemoryStatus;
const BASE_URL = process.env.CCC_BASE_URL ?? "http://127.0.0.1:5050";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
async function apiFetch(path, options = {}) {
    const method = (options.method ?? "GET").toUpperCase();
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
    };
    if (MUTATING_METHODS.has(method)) {
        headers["X-Requested-With"] = "XMLHttpRequest";
    }
    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,
    });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`CCC API ${method} ${path} → ${response.status}: ${text}`);
    }
    return response.json();
}
async function searchMemory(query, mode = "hybrid", topK = 10) {
    return apiFetch("/api/memory/rag/search", {
        method: "POST",
        body: JSON.stringify({ query, mode, top_k: topK }),
    });
}
async function addMemory(content, source = "mcp", tags = [], docId) {
    return apiFetch("/api/memory/rag/add", {
        method: "POST",
        body: JSON.stringify({ content, source, tags, doc_id: docId }),
    });
}
async function listMemories(filters) {
    const params = new URLSearchParams();
    if (filters?.source)
        params.set("source", filters.source);
    if (filters?.tag)
        params.set("tag", filters.tag);
    const qs = params.toString();
    return apiFetch(`/api/memory/rag/list${qs ? `?${qs}` : ""}`);
}
async function getMemoryStatus() {
    return apiFetch("/api/memory/rag/status");
}
//# sourceMappingURL=client.js.map