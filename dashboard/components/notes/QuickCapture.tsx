"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Field, Input, Textarea } from "@/components/common/Field";

/** Global quick-capture modal, opened with Ctrl+Shift+K from anywhere in the app. */
export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function reset() {
    setOpen(false);
    setText("");
    setExpanded(false);
    setTitle("");
    setFolder("");
    setBusy(false);
    setError(null);
    setSavedPath(null);
  }

  async function post(url: string, body: unknown): Promise<string> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (res.status !== 201) throw new Error(data?.error || `HTTP ${res.status}`);
    return data.relPath as string;
  }

  async function submit(action: () => Promise<string>) {
    if (busy || savedPath) return;
    setBusy(true);
    setError(null);
    try {
      const relPath = await action();
      setSavedPath(relPath);
      setTimeout(reset, 1200);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  function appendDaily() {
    if (!text.trim()) return;
    void submit(() => post("/api/vault/daily/append", { text: text.trim() }));
  }

  function saveAsNote() {
    if (!text.trim() || !title.trim() || !folder.trim()) return;
    void submit(() => post("/api/vault/note", { folder: folder.trim(), title: title.trim(), content: text }));
  }

  if (!open) return null;

  return (
    <Modal
      title="Quick capture"
      onClose={reset}
      footer={
        expanded ? (
          <Button variant="primary" onClick={saveAsNote} disabled={busy || !text.trim() || !title.trim() || !folder.trim()}>
            {busy ? "Saving..." : "Save note"}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setExpanded(true)} disabled={busy}>
              Save as note…
            </Button>
            <Button variant="primary" onClick={appendDaily} disabled={busy || !text.trim()}>
              {busy ? "Saving..." : "Append to today's daily"}
            </Button>
          </>
        )
      }
    >
      <Field label="Capture" hint={expanded ? undefined : "Enter appends to today's daily note."}>
        <Textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !expanded) {
              e.preventDefault();
              appendDaily();
            }
          }}
          autoFocus
          placeholder="What's on your mind?"
        />
      </Field>
      {expanded && (
        <>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting notes" />
          </Field>
          <Field label="Folder" hint="Allowed top-level: raw, wiki, projects, outputs, learning, research.">
            <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="raw/daily" />
          </Field>
        </>
      )}
      {savedPath && <p className="text-sm text-ok">Saved to {savedPath}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
