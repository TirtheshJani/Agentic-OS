"use client";
import { useEffect, useRef } from "react";
import type Sigma from "sigma";

export interface GraphNode {
  id: string;
  title: string;
  path: string | null;
  folder: string;
  tags: string[];
  degree: number;
  ghost: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Case-insensitive title filter; non-matching nodes are dimmed out. */
  highlight: string;
  onSelectNode: (node: GraphNode) => void;
}

// Sigma's WebGL renderer needs concrete color strings, so we resolve the design
// tokens (CSS custom properties) at render time. Folders map onto semantic tokens
// (accent/ok/warn/danger) plus ink tiers so node colors follow the active theme.
const FOLDER_TOKENS: Record<string, string> = {
  raw: "--warn",
  wiki: "--accent",
  outputs: "--ok",
  projects: "--accent-ink",
  shared: "--danger",
  archive: "--text-3",
  "(root)": "--text-2",
  "(unresolved)": "--text-3",
};

/** Read a CSS custom property off the document root (theme-aware token value). */
function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function GraphView({ nodes, edges, highlight, onSelectNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Build (and rebuild) the renderer when the data set changes.
  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    (async () => {
      // sigma touches browser globals; load it client-side only (same pattern
      // as xterm in RunTerminal).
      const [{ default: Graph }, { default: forceAtlas2 }, { default: SigmaCtor }] = await Promise.all([
        import("graphology"),
        import("graphology-layout-forceatlas2"),
        import("sigma"),
      ]);
      if (disposed || !containerRef.current) return;

      const defaultNode = token("--text-3", "#94a3b8");
      const edgeColor = token("--border-2", "#374151");
      const graph = new Graph({ multi: true, type: "undirected" });
      for (const n of nodes) {
        const tk = FOLDER_TOKENS[n.folder];
        graph.addNode(n.id, {
          label: n.title,
          size: Math.min(3 + Math.sqrt(n.degree) * 2, 14),
          color: tk ? token(tk, defaultNode) : defaultNode,
          x: Math.random(),
          y: Math.random(),
        });
      }
      for (const e of edges) {
        if (graph.hasNode(e.source) && graph.hasNode(e.target)) {
          graph.addEdge(e.source, e.target, { size: 0.5, color: edgeColor });
        }
      }

      if (graph.order > 1) {
        forceAtlas2.assign(graph, {
          iterations: 200,
          settings: { ...forceAtlas2.inferSettings(graph), scalingRatio: 4 },
        });
      }

      sigmaRef.current?.kill();
      const renderer = new SigmaCtor(graph, containerRef.current, {
        renderEdgeLabels: false,
        labelRenderedSizeThreshold: 7,
        labelColor: { color: token("--text-3", "#9ca3af") },
      });
      renderer.on("clickNode", ({ node }) => {
        const data = nodesRef.current.find((n) => n.id === node);
        if (data) onSelectNode(data);
      });
      sigmaRef.current = renderer;
    })();

    return () => {
      disposed = true;
      sigmaRef.current?.kill();
      sigmaRef.current = null;
    };
    // onSelectNode goes through a ref-backed lookup; data identity drives rebuilds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // Dim nodes that do not match the highlight filter.
  useEffect(() => {
    const renderer = sigmaRef.current;
    if (!renderer) return;
    const graph = renderer.getGraph();
    const q = highlight.trim().toLowerCase();
    graph.forEachNode((id, attrs) => {
      const match = !q || String(attrs.label ?? "").toLowerCase().includes(q);
      graph.setNodeAttribute(id, "hidden", !match && q.length > 0);
    });
    renderer.refresh();
  }, [highlight, nodes]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[calc(100vh-220px)] min-h-[400px] rounded-card border border-line bg-canvas shadow-card"
    />
  );
}
