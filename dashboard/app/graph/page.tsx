"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GraphView, type GraphNode, type GraphEdge } from "@/components/graph/GraphView";
import { Drawer } from "@/components/common/Drawer";
import { useStream } from "@/hooks/useStream";

interface SearchResult {
  path: string;
  title: string;
  snippet: string;
}

export default function GraphPage() {
  const [data, setData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [folder, setFolder] = useState("");
  const [tag, setTag] = useState("");
  const [highlight, setHighlight] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [preview, setPreview] = useState<{ title: string; path: string; content: string } | null>(null);

  const reload = useCallback(async () => {
    const params = new URLSearchParams();
    if (folder) params.set("folder", folder);
    if (tag) params.set("tag", tag);
    const res = await fetch(`/api/graph?${params}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, [folder, tag]);

  useEffect(() => {
    reload();
  }, [reload]);

  useStream((event) => {
    if (event.kind === "vault.indexed") reload();
  });

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const n of data?.nodes ?? []) for (const t of n.tags) set.add(t);
    return [...set].sort();
  }, [data]);

  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const n of data?.nodes ?? []) if (!n.ghost) set.add(n.folder);
    return [...set].sort();
  }, [data]);

  async function openNote(path: string, title: string) {
    const res = await fetch(`/api/notes?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    if (!res.ok) return;
    const note = await res.json();
    setPreview({ title, path, content: note.content });
  }

  async function runSearch(q: string) {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    if (res.ok) setSearchResults((await res.json()).results);
  }

  return (
    <main className="max-w-7xl mx-auto p-6">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Knowledge Graph</h1>
        <span className="text-sm text-gray-500">
          {data ? `${data.nodes.filter(n => !n.ghost).length} notes, ${data.edges.length} links` : "indexing..."}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm"
        >
          <option value="">All folders</option>
          {folders.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm"
        >
          <option value="">All tags</option>
          {tags.map((t) => <option key={t} value={t}>#{t}</option>)}
        </select>
        <input
          value={highlight}
          onChange={(e) => {
            setHighlight(e.target.value);
            runSearch(e.target.value);
          }}
          placeholder="Search notes (title filter + full text)"
          className="flex-1 min-w-[220px] rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-1.5 text-sm"
        />
      </div>

      {searchResults && searchResults.length > 0 && (
        <div className="mb-4 rounded-md border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-900 max-h-48 overflow-y-auto">
          {searchResults.map((r) => (
            <button
              key={r.path}
              onClick={() => openNote(r.path, r.title)}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
            >
              <span className="font-medium">{r.title}</span>
              <span className="text-gray-400 text-xs ml-2">{r.path}</span>
              <span
                className="block text-xs text-gray-500 mt-0.5"
                dangerouslySetInnerHTML={{ __html: r.snippet }}
              />
            </button>
          ))}
        </div>
      )}

      {!data ? (
        <p className="text-sm text-gray-400">Loading graph...</p>
      ) : (
        <GraphView
          nodes={data.nodes}
          edges={data.edges}
          highlight={highlight}
          onSelectNode={(n) => {
            if (n.path) openNote(n.path, n.title);
          }}
        />
      )}

      {preview && (
        <Drawer
          title={preview.title}
          width="lg"
          onClose={() => setPreview(null)}
          footer={
            <a
              href={`obsidian://open?vault=vault&file=${encodeURIComponent(preview.path)}`}
              className="text-sm px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700"
            >
              Open in Obsidian
            </a>
          }
        >
          <p className="text-xs text-gray-400 font-mono mb-3">{preview.path}</p>
          <pre className="text-xs whitespace-pre-wrap leading-relaxed font-mono">{preview.content}</pre>
        </Drawer>
      )}
    </main>
  );
}
