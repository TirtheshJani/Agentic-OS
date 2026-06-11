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

const FOLDER_COLORS: Record<string, string> = {
  raw: "#f59e0b",
  wiki: "#60a5fa",
  outputs: "#34d399",
  projects: "#c084fc",
  shared: "#f472b6",
  archive: "#9ca3af",
  "(root)": "#e5e7eb",
  "(unresolved)": "#4b5563",
};

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

      const graph = new Graph({ multi: true, type: "undirected" });
      for (const n of nodes) {
        graph.addNode(n.id, {
          label: n.title,
          size: Math.min(3 + Math.sqrt(n.degree) * 2, 14),
          color: FOLDER_COLORS[n.folder] ?? "#94a3b8",
          x: Math.random(),
          y: Math.random(),
        });
      }
      for (const e of edges) {
        if (graph.hasNode(e.source) && graph.hasNode(e.target)) {
          graph.addEdge(e.source, e.target, { size: 0.5, color: "#374151" });
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
        labelColor: { color: "#9ca3af" },
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
      className="w-full h-[calc(100vh-220px)] min-h-[400px] rounded-md border border-line bg-gray-950"
    />
  );
}
