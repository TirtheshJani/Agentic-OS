"use client";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { Input, Textarea } from "@/components/common/Field";
import { useStream } from "@/hooks/useStream";

interface KnowledgeDoc {
  name: string;
  relPath: string;
  size: number;
  mtime: number;
  chunkCount: number;
  embedded: number;
}

interface OutputFile {
  name: string;
  relPath: string;
  mtime: number;
}

interface KnowledgeData {
  docs: KnowledgeDoc[];
  instructions: { exists: boolean; content: string };
  outputs: OutputFile[];
}

interface AskResult {
  answer: string;
  provider: string;
  citations: { n: number; notePath: string; title: string }[];
  degraded?: { vector: boolean; reason?: string };
  error?: string;
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error(`failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

interface Props {
  projectSlug: string;
}

export function KnowledgeTab({ projectSlug }: Props) {
  const [data, setData] = useState<KnowledgeData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [instructions, setInstructions] = useState("");
  const instructionsLoaded = useRef(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [chatOpen, setChatOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectSlug}/knowledge`, { cache: "no-store" });
    if (!res.ok) {
      setLoadError(`Failed to load knowledge (${res.status})`);
      return;
    }
    const d = (await res.json()) as KnowledgeData;
    setData(d);
    setLoadError(null);
    // Seed the editor once; never clobber in-progress edits on live refresh.
    if (!instructionsLoaded.current) {
      setInstructions(d.instructions.content);
      instructionsLoaded.current = true;
    }
  }, [projectSlug]);

  useEffect(() => {
    reload();
  }, [reload]);

  useStream((event) => {
    if (event.kind === "vault.indexed" || event.kind === "rag.embeddings") reload();
  });

  async function uploadFiles(files: FileList | File[]) {
    setUploadError(null);
    const accepted = Array.from(files).filter((f) => /\.(md|txt)$/i.test(f.name));
    if (accepted.length === 0) {
      setUploadError("Only .md and .txt files are accepted.");
      return;
    }
    setUploading(true);
    try {
      for (const file of accepted) {
        const content = await readFileText(file);
        const res = await fetch(`/api/projects/${projectSlug}/knowledge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, content }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? `upload failed (${res.status})`);
        }
      }
      await reload();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function removeDoc(name: string) {
    if (!confirm(`Delete knowledge doc ${name}? Agents will no longer see it.`)) return;
    const res = await fetch(`/api/projects/${projectSlug}/knowledge/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(`Failed: ${d.error ?? res.status}`);
      return;
    }
    reload();
  }

  async function saveInstructions() {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/projects/${projectSlug}/instructions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: instructions }),
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }

  async function ask() {
    const q = question.trim();
    if (!q) return;
    setAsking(true);
    setAskError(null);
    setAskResult(null);
    try {
      const res = await fetch("/api/rag/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, scope: { pathPrefix: `projects/${projectSlug}/` } }),
      });
      const d = (await res.json()) as AskResult;
      if (!res.ok || d.error) {
        setAskError(d.error ?? `ask failed (${res.status})`);
        return;
      }
      setAskResult(d);
    } catch (err) {
      setAskError((err as Error).message);
    } finally {
      setAsking(false);
    }
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="max-w-3xl">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Knowledge docs</h3>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            uploadFiles(e.dataTransfer.files);
          }}
          className={clsx(
            "rounded-md border border-dashed p-4 text-center text-sm transition-colors",
            dragOver
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
              : "border-gray-300 dark:border-gray-700"
          )}
        >
          <span className="text-gray-500">Drop .md or .txt files here, or</span>{" "}
          <Button variant="ghost" className="text-blue-600" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? "Uploading..." : "browse files"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {uploadError && <p className="text-xs text-red-600 mt-2">{uploadError}</p>}

        {data.docs.length === 0 ? (
          <EmptyState title="No knowledge docs" description="Drop .md or .txt files above to give agents project context." />
        ) : (
          <ul className="space-y-2 mt-3">
            {data.docs.map((doc) => (
              <li
                key={doc.relPath}
                className="flex items-center justify-between gap-3 rounded-md border border-gray-200 dark:border-gray-800 p-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium" title={doc.relPath}>{doc.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{(doc.size / 1024).toFixed(1)} KB</div>
                </div>
                <span
                  className={clsx(
                    "text-xs px-1.5 py-0.5 rounded whitespace-nowrap",
                    doc.chunkCount > 0 && doc.embedded === doc.chunkCount
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400"
                  )}
                >
                  {doc.embedded}/{doc.chunkCount} embedded
                </span>
                <Button variant="ghost" onClick={() => removeDoc(doc.name)}>Delete</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Instructions</h3>
        <Textarea
          rows={6}
          value={instructions}
          placeholder="Project-specific guidance for agents, e.g. coding conventions, definitions, links."
          onChange={(e) => {
            setInstructions(e.target.value);
            setSaveState("idle");
          }}
        />
        <p className="text-xs text-gray-500 mt-1">
          Injected into every agent run in this project as a system-prompt prefix.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Button variant="primary" onClick={saveInstructions} disabled={saveState === "saving"}>
            {saveState === "saving" ? "Saving..." : "Save"}
          </Button>
          {saveState === "saved" && <span className="text-xs text-green-600">Saved.</span>}
          {saveState === "error" && <span className="text-xs text-red-600">Save failed.</span>}
        </div>
      </section>

      <section className="mt-8">
        <button
          onClick={() => setChatOpen((v) => !v)}
          aria-expanded={chatOpen}
          className="text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          {chatOpen ? "▾" : "▸"} Project chat
        </button>
        {chatOpen && (
          <div className="mt-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask();
              }}
              className="flex gap-2"
            >
              <Input
                value={question}
                placeholder="Ask about this project's knowledge..."
                onChange={(e) => setQuestion(e.target.value)}
              />
              <Button type="submit" variant="primary" disabled={asking || !question.trim()}>
                {asking ? "Asking..." : "Ask"}
              </Button>
            </form>
            {asking && <p className="text-sm text-gray-500 mt-2">Thinking...</p>}
            {askError && <p className="text-sm text-red-600 mt-2">{askError}</p>}
            {askResult && (
              <div className="mt-3 rounded-md border border-gray-200 dark:border-gray-800 p-3 text-sm">
                <p className="whitespace-pre-wrap">{askResult.answer}</p>
                {askResult.citations.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-gray-500">
                    {askResult.citations.map((c) => (
                      <li key={c.n} className="truncate" title={c.notePath}>
                        [{c.n}] {c.title} ({c.notePath})
                      </li>
                    ))}
                  </ul>
                )}
                {askResult.degraded?.vector && (
                  <p className="text-xs text-yellow-600 mt-2">
                    Keyword-only retrieval{askResult.degraded.reason ? `: ${askResult.degraded.reason}` : "."}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Outputs</h3>
        {data.outputs.length === 0 ? (
          <EmptyState
            title="No outputs yet"
            description={`Agents write deliverables to vault/projects/${projectSlug}/outputs/.`}
          />
        ) : (
          <ul className="space-y-2">
            {data.outputs.map((out) => (
              <li
                key={out.relPath}
                className="flex items-center justify-between gap-3 rounded-md border border-gray-200 dark:border-gray-800 p-2 text-sm"
              >
                <div className="truncate font-medium" title={out.relPath}>{out.name}</div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(out.mtime).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
