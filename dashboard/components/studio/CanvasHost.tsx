"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/common/Button";

// Excalidraw touches window at module scope: client-only dynamic import,
// same rule as xterm and sigma (see CLAUDE.md gotchas).
const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then((m) => m.Excalidraw), {
  ssr: false,
  loading: () => <p className="text-sm text-ink3 p-4">Loading canvas...</p>,
});

interface Scene {
  elements?: readonly unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export function CanvasHost({ slug, name }: { slug: string; name: string }) {
  const [initial, setInitial] = useState<Scene | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // The Excalidraw imperative API; typed loosely to keep the SDK surface out of our types.
  const apiRef = useRef<{
    getSceneElements: () => readonly unknown[];
    getAppState: () => Record<string, unknown>;
    getFiles: () => Record<string, unknown>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/projects/${slug}/design/canvas/${name}`, { cache: "no-store" });
      if (cancelled) return;
      if (res.ok) setInitial(((await res.json()) as { scene: Scene }).scene);
      else setInitial("new");
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, name]);

  async function save() {
    const api = apiRef.current;
    if (!api) return;
    setSaving(true);
    setMessage(null);
    try {
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const scene = { elements, appState: { viewBackgroundColor: appState.viewBackgroundColor }, files: api.getFiles() };

      // SVG export runs client-side so the server stays rendering-free.
      let svg: string | null = null;
      try {
        const { exportToSvg } = await import("@excalidraw/excalidraw");
        const node = await exportToSvg({
          elements: elements as never,
          appState: { exportBackground: true } as never,
          files: api.getFiles() as never,
        });
        svg = new XMLSerializer().serializeToString(node);
      } catch (err) {
        console.warn("svg export failed", err);
      }

      const res = await fetch(`/api/projects/${slug}/design/canvas/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene, svg }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`);
      setMessage("Saved.");
    } catch (err) {
      setMessage(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, name]);

  if (initial === null) return <p className="text-sm text-ink3 p-4">Loading canvas...</p>;

  return (
    <div className="flex flex-col h-[75vh]">
      <div className="flex items-center gap-2 mb-2">
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save (Ctrl+S)"}
        </Button>
        {message && <span className="text-sm text-ink3">{message}</span>}
      </div>
      <div className="flex-1 rounded-card border border-line bg-surface overflow-hidden shadow-card">
        <Excalidraw
          initialData={initial === "new" ? undefined : (initial as never)}
          excalidrawAPI={(api) => {
            apiRef.current = api as never;
          }}
        />
      </div>
    </div>
  );
}
