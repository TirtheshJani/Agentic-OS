"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/common/Button";
import { Textarea } from "@/components/common/Field";
import { useStream } from "@/hooks/useStream";
import type { ResearchProject, ResearchSource, ResearchNote } from "@/lib/research/projects";

interface DetailData {
  meta: ResearchProject;
  sources: ResearchSource[];
  notes: ResearchNote[];
}

interface AskResult {
  answer: string | null;
  provider: string;
  citations: Array<{ n: number; notePath: string; title: string }>;
  chunks: Array<{ notePath: string; title: string; content: string; score: number }>;
  degraded: { vector: boolean; reason?: string };
  error?: string;
}

export function ResearchDetail({ slug }: { slug: string }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/research/${slug}`, { cache: "no-store" });
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`);
      return;
    }
    setData((await res.json()) as DetailData);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useStream((event) => {
    if (event.kind === "vault.indexed") void load();
  });

  function toggle(relPath: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) next.delete(relPath);
      else next.add(relPath);
      return next;
    });
  }

  async function collect() {
    setCollecting(true);
    setCollectMsg(null);
    try {
      const res = await fetch(`/api/research/${slug}/collect`, { method: "POST", body: "{}" });
      const body = (await res.json()) as { issueId?: number; error?: string; setup?: string[] };
      if (!res.ok) throw new Error([body.error, ...(body.setup ?? [])].filter(Boolean).join(" "));
      setCollectMsg(`Collection issue #${body.issueId} filed.`);
    } catch (err) {
      setCollectMsg((err as Error).message);
    } finally {
      setCollecting(false);
    }
  }

  async function ask() {
    if (!question.trim()) return;
    setAsking(true);
    setAnswer(null);
    try {
      const res = await fetch(`/api/research/${slug}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: question, includePaths: selected.size > 0 ? [...selected] : undefined }),
      });
      setAnswer((await res.json()) as AskResult);
    } catch (err) {
      setAnswer({
        answer: null,
        provider: "none",
        citations: [],
        chunks: [],
        degraded: { vector: true },
        error: (err as Error).message,
      });
    } finally {
      setAsking(false);
    }
  }

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return <p className="text-sm text-ink3">Loading research project...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">{data.meta.title}</h1>
        <Button onClick={collect} disabled={collecting}>
          {collecting ? "Filing..." : "Run collection"}
        </Button>
      </div>
      <p className="text-sm text-ink3 mb-1">{data.meta.question}</p>
      <p className="text-xs text-ink3 mb-4">
        status: {data.meta.status}
        {collectMsg && <span className="ml-2 text-ink2">{collectMsg}</span>}
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-semibold mb-2">Sources ({data.sources.length})</h2>
          {data.sources.length === 0 && (
            <p className="text-sm text-ink3">No sources yet. Run a collection or drop .md files into sources/.</p>
          )}
          <ul className="space-y-1.5">
            {data.sources.map((s) => (
              <li key={s.relPath} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(s.relPath)}
                  onChange={() => toggle(s.relPath)}
                  aria-label={`Include ${s.title} in chat context`}
                />
                <div>
                  <span className="font-medium">{s.title}</span>
                  {!s.attributed && (
                    <span className="ml-1.5 rounded bg-yellow-100 dark:bg-yellow-950 px-1 py-0.5 text-xs text-yellow-700 dark:text-yellow-300">
                      unattributed
                    </span>
                  )}
                  <div className="text-xs text-ink3">
                    {s.sourceType ?? "?"}
                    {s.sourceUrl && (
                      <>
                        {" · "}
                        <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                          {s.sourceUrl.slice(0, 60)}
                        </a>
                      </>
                    )}
                    {s.collectedBy && ` · by ${s.collectedBy}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <h2 className="text-sm font-semibold mt-5 mb-2">Notes ({data.notes.length})</h2>
          <ul className="space-y-1 text-sm">
            {data.notes.map((n) => (
              <li key={n.relPath} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(n.relPath)}
                  onChange={() => toggle(n.relPath)}
                  aria-label={`Include ${n.name} in chat context`}
                />
                {n.name}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-2">
            Chat {selected.size > 0 ? `(scoped to ${selected.size} selected)` : "(whole project)"}
          </h2>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="Ask about the collected sources..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
            }}
          />
          <Button variant="primary" onClick={ask} disabled={asking || !question.trim()} className="mt-2">
            {asking ? "Asking..." : "Ask"}
          </Button>

          {answer && (
            <div className="mt-4 space-y-3">
              {answer.error && <p className="text-sm text-danger">{answer.error}</p>}
              {answer.degraded.vector && (
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  Keyword + link-graph retrieval only ({answer.degraded.reason ?? "no embedding provider"}).
                </p>
              )}
              {answer.answer ? (
                <pre className="whitespace-pre-wrap text-sm font-sans rounded-md border border-line p-3">
                  {answer.answer}
                </pre>
              ) : (
                !answer.error && <p className="text-sm text-ink3">No answer generated; showing retrieval only.</p>
              )}
              {answer.chunks.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-ink2">
                    Retrieved context ({answer.chunks.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {answer.chunks.map((c, i) => (
                      <div key={i} className="rounded border border-line p-2">
                        <div className="text-xs text-ink3">
                          [{i + 1}] {c.notePath} · {c.score.toFixed(3)}
                        </div>
                        <pre className="whitespace-pre-wrap text-xs mt-1 max-h-32 overflow-auto">{c.content}</pre>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
