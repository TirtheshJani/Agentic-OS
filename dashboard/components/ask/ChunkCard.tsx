"use client";
import { useState } from "react";
import clsx from "clsx";

export type Retriever = "vector" | "fts" | "graph";

export interface RetrievedChunk {
  notePath: string;
  title: string;
  heading: string;
  chunkIndex: number;
  content: string;
  score: number;
  retrievers: Retriever[];
}

const retrieverStyles: Record<Retriever, string> = {
  vector: "bg-accent-bg text-accent-ink",
  fts: "bg-ok-bg text-ok",
  graph: "bg-surface2 text-ink2",
};

interface ChunkCardProps {
  chunk: RetrievedChunk;
  onOpenNote: (path: string, title: string) => void;
}

export function ChunkCard({ chunk, onOpenNote }: ChunkCardProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="rounded-card border border-line bg-surface p-3 text-sm transition-colors hover:border-accent-line">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          onClick={() => onOpenNote(chunk.notePath, chunk.title)}
          className="font-medium text-ink hover:text-accent text-left"
        >
          {chunk.title}
        </button>
        <span className="text-xs text-ink3 font-mono">{chunk.notePath}</span>
        {chunk.heading && <span className="text-xs text-ink3">{chunk.heading}</span>}
        <span className="text-xs text-ink3 font-mono ml-auto">{chunk.score.toFixed(3)}</span>
        {chunk.retrievers.map((r) => (
          <span
            key={r}
            className={clsx(
              "rounded-pill px-1.5 py-0.5 font-label text-[9px] uppercase tracking-wide",
              retrieverStyles[r]
            )}
          >
            {r}
          </span>
        ))}
      </div>
      <pre
        className={clsx(
          "text-xs whitespace-pre-wrap font-mono leading-relaxed text-ink2 overflow-y-auto",
          expanded ? "max-h-96" : "max-h-24"
        )}
      >
        {chunk.content}
      </pre>
      <button onClick={() => setExpanded(!expanded)} className="text-xs text-accent hover:underline mt-1">
        {expanded ? "Collapse" : "Expand"}
      </button>
    </li>
  );
}
