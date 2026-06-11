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
  vector: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  fts: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  graph: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

interface ChunkCardProps {
  chunk: RetrievedChunk;
  onOpenNote: (path: string, title: string) => void;
}

export function ChunkCard({ chunk, onOpenNote }: ChunkCardProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="rounded-md border border-line p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          onClick={() => onOpenNote(chunk.notePath, chunk.title)}
          className="font-medium hover:underline text-left"
        >
          {chunk.title}
        </button>
        <span className="text-xs text-ink3 font-mono">{chunk.notePath}</span>
        {chunk.heading && <span className="text-xs text-ink3">{chunk.heading}</span>}
        <span className="text-xs text-ink3 ml-auto">{chunk.score.toFixed(3)}</span>
        {chunk.retrievers.map((r) => (
          <span key={r} className={clsx("text-xs px-1.5 py-0.5 rounded", retrieverStyles[r])}>
            {r}
          </span>
        ))}
      </div>
      <pre
        className={clsx(
          "text-xs whitespace-pre-wrap font-mono leading-relaxed overflow-y-auto",
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
