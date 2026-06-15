"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GraphView, type GraphNode, type GraphEdge } from "@/components/graph/GraphView";
import { Drawer } from "@/components/common/Drawer";
import { SectionHeader } from "@/components/common/SectionHeader";
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
      <SectionHeader
        kicker="KNOWLEDGE MAP"
        title="Knowledge Graph"
        action={
          <span className="text-sm text-ink3">
            {data ? `${data.nodes.filter((n) => !n.ghost).length} notes, ${data.edges.length} links` : "indexing..."}
          </span>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          className="rounded-pill border border-line2 bg-surface px-2 py-1.5 text-sm text-ink"
        >
          <option value="">All folders</option>
          {folders.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="rounded-pill border border-line2 bg-surface px-2 py-1.5 text-sm text-ink"
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
          className="flex-1 min-w-[220px] rounded-pill border border-line2 bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink3"
        />
      </div>

      {searchResults && searchResults.length > 0 && (
        <div className="mb-4 rounded-card border border-line bg-surface divide-y divide-line max-h-48 overflow-y-auto">
          {searchResults.map((r) => (
            <button
              key={r.path}
              onClick={() => openNote(r.path, r.title)}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-surface2"
            >
              <span className="font-medium text-ink">{r.title}</span>
              <span className="text-ink3 text-xs ml-2 font-mono">{r.path}</span>
              <span
                className="block text-xs text-ink3 mt-0.5"
                dangerouslySetInnerHTML={{ __html: r.snippet }}
              />
            </button>
          ))}
        </div>
      )}

      {!data ? (
        <p className="text-sm text-ink3">Loading graph...</p>
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
              className="text-sm px-3 py-1.5 rounded-pill bg-accent text-white shadow-glow hover:opacity-90"
            >
              Open in Obsidian
            </a>
          }
        >
          <p className="text-xs text-ink3 font-mono mb-3">{preview.path}</p>
          <pre className="text-xs whitespace-pre-wrap leading-relaxed font-mono text-ink2">{preview.content}</pre>
        </Drawer>
      )}
    </main>
  );
}
