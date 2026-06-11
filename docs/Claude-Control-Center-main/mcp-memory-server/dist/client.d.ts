export declare function searchMemory(query: string, mode?: "hybrid" | "local" | "global", topK?: number): Promise<unknown>;
export declare function addMemory(content: string, source?: string, tags?: string[], docId?: string): Promise<unknown>;
export declare function listMemories(filters?: {
    source?: string;
    tag?: string;
}): Promise<unknown>;
export declare function getMemoryStatus(): Promise<unknown>;
//# sourceMappingURL=client.d.ts.map