"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Field";
import { CanvasHost } from "@/components/studio/CanvasHost";
import type { CanvasInfo, DesignDoc } from "@/lib/design/canvases";

export function StudioWorkspace({ slug }: { slug: string }) {
  const [canvases, setCanvases] = useState<CanvasInfo[]>([]);
  const [docs, setDocs] = useState<DesignDoc[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${slug}/design`, { cache: "no-store" });
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`);
      return;
    }
    const data = (await res.json()) as { canvases: CanvasInfo[]; docs: DesignDoc[] };
    setCanvases(data.canvases);
    setDocs(data.docs);
    setActive((cur) => cur ?? data.canvases[0]?.name ?? null);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  function createCanvas() {
    const name = newName
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!name) return;
    setActive(name);
    setNewName("");
    // The canvas materializes on first save.
  }

  async function requestReview() {
    setMessage(null);
    const res = await fetch(`/api/projects/${slug}/design/review`, { method: "POST" });
    const body = (await res.json()) as { issueId?: number; error?: string };
    setMessage(res.ok ? `Design review issue #${body.issueId} filed (backlog).` : (body.error ?? "failed"));
  }

  if (error) return <p className="text-sm text-danger">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Studio: {slug}</h1>
          <p className="text-sm text-ink3">
            Diagrams save to vault/projects/{slug}/design/ as scene JSON + SVG; docs are vault notes.
          </p>
        </div>
        <Button onClick={requestReview}>Request design review</Button>
      </div>
      {message && <p className="text-sm text-ink2 mb-3">{message}</p>}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {canvases.map((c) => (
          <button
            key={c.name}
            onClick={() => setActive(c.name)}
            className={
              active === c.name
                ? "rounded-md px-2 py-1 text-sm bg-surface2 font-medium"
                : "rounded-md px-2 py-1 text-sm text-ink2 hover:bg-surface2"
            }
          >
            {c.name}
          </button>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="new-canvas-name"
            className="w-44"
            onKeyDown={(e) => e.key === "Enter" && createCanvas()}
          />
          <Button onClick={createCanvas} disabled={!newName.trim()}>
            New canvas
          </Button>
        </div>
      </div>

      {active ? (
        <CanvasHost key={`${slug}:${active}`} slug={slug} name={active} />
      ) : (
        <p className="text-sm text-ink3">Create a canvas to start diagramming.</p>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold mb-2">Design docs</h2>
        {docs.length === 0 ? (
          <p className="text-sm text-ink3">
            No design docs yet. Create ARCHITECTURE.md in the Notes view under projects/{slug}/design/.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {docs.map((d) => (
              <li key={d.relPath}>
                <Link href={`/notes?path=${encodeURIComponent(d.relPath)}`} className="hover:underline">
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
