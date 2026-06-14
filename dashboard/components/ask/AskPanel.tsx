"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/common/Button";
import { Field, Input, Textarea } from "@/components/common/Field";
import { EmptyState } from "@/components/common/EmptyState";
import { Drawer } from "@/components/common/Drawer";
import { ChunkCard, type RetrievedChunk } from "@/components/ask/ChunkCard";
import { DegradedBanner } from "@/components/ask/DegradedBanner";

interface AskResult {
  answer: string | null;
  provider: "gemini-cli" | "claude-cli" | "none";
  citations: Array<{ n: number; notePath: string; title: string }>;
  chunks: RetrievedChunk[];
  degraded: { vector: boolean; reason?: string };
  error?: string;
}

export function AskPanel() {
  const [question, setQuestion] = useState("");
  const [pathPrefix, setPathPrefix] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; path: string; content: string } | null>(null);

  async function ask() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rag/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q,
          ...(pathPrefix.trim() ? { scope: { pathPrefix: pathPrefix.trim() } } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      // A 502 (answer CLI failed) still carries chunks; render them with the error.
      if (data && Array.isArray(data.chunks)) {
        setResult(data as AskResult);
      } else {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function openNote(path: string, title: string) {
    const res = await fetch(`/api/notes?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    if (!res.ok) return;
    const note = await res.json();
    setPreview({ title, path, content: note.content });
  }

  return (
    <div className="space-y-4">
      <Field label="Question" hint="Enter submits, Shift+Enter adds a newline.">
        <Textarea
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask();
            }
          }}
          placeholder="What did the trend scans say about local LLM tooling?"
        />
      </Field>
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-ink3 hover:underline"
        >
          {showAdvanced ? "Hide advanced" : "Advanced"}
        </button>
        {showAdvanced && (
          <div className="mt-2">
            <Field label="Scope: path prefix" hint="Restrict retrieval to notes under this vault path, e.g. raw/daily/.">
              <Input value={pathPrefix} onChange={(e) => setPathPrefix(e.target.value)} placeholder="raw/daily/" />
            </Field>
          </div>
        )}
      </div>
      <Button variant="primary" onClick={ask} disabled={loading || !question.trim()}>
        {loading ? "Asking..." : "Ask"}
      </Button>

      {error && <p className="text-sm text-danger">{error}</p>}

      {!result && !loading && !error && (
        <EmptyState
          title="Ask the vault"
          description="Hybrid retrieval pulls the most relevant notes; the answer cites them as [n]."
        />
      )}

      {result && (
        <div className="space-y-4">
          {result.degraded.vector && <DegradedBanner reason={result.degraded.reason} />}
          {result.error && (
            <p className="text-sm text-danger">
              Answer generation failed: {result.error}. Showing retrieved context below.
            </p>
          )}
          {result.provider === "none" && result.answer === null && !result.error && result.chunks.length > 0 && (
            <p className="text-sm text-ink3">
              Answer generation is off — showing retrieval only.{" "}
              <Link href="/settings" className="text-accent hover:underline">
                Settings
              </Link>
            </p>
          )}
          {result.answer && (
            <section className="rounded-card border border-line bg-surface p-4">
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-ink">{result.answer}</p>
              {result.citations.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {result.citations.map((c) => (
                    <button
                      key={c.n}
                      onClick={() => openNote(c.notePath, c.title)}
                      className="text-xs px-2 py-0.5 rounded-pill border border-line2 text-ink2 hover:border-accent-line hover:bg-surface2"
                    >
                      <span className="font-label font-semibold text-accent-ink">[{c.n}]</span> {c.title}{" "}
                      <span className="text-ink3 font-mono">{c.notePath}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
          <section>
            <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-3">
              Retrieved context ({result.chunks.length})
            </h2>
            {result.chunks.length === 0 ? (
              <p className="text-sm text-ink3">No matching notes found.</p>
            ) : (
              <ul className="space-y-2">
                {result.chunks.map((c) => (
                  <ChunkCard key={`${c.notePath}#${c.chunkIndex}`} chunk={c} onOpenNote={openNote} />
                ))}
              </ul>
            )}
          </section>
        </div>
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
    </div>
  );
}
