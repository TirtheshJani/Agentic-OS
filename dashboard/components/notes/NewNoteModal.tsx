"use client";
import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Field, Input } from "@/components/common/Field";

interface NewNoteModalProps {
  onClose: () => void;
  onCreated: (relPath: string) => void;
}

export function NewNoteModal({ onClose, onCreated }: NewNoteModalProps) {
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!title.trim() || !folder.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/vault/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: folder.trim(), title: title.trim(), content: "" }),
      });
      const data = await res.json().catch(() => null);
      if (res.status !== 201) throw new Error(data?.error || `HTTP ${res.status}`);
      onCreated(data.relPath);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  }

  function submitOnEnter(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void create();
    }
  }

  return (
    <Modal
      title="New note"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void create()} disabled={creating || !title.trim() || !folder.trim()}>
            {creating ? "Creating..." : "Create"}
          </Button>
        </>
      }
    >
      <Field label="Title" hint="Filename is the kebab-cased title.">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={submitOnEnter} autoFocus placeholder="Meeting notes" />
      </Field>
      <Field
        label="Folder"
        hint="Vault-relative, e.g. raw/daily, wiki/research, projects/<slug>. Allowed top-level: raw, wiki, projects, outputs, learning, research."
      >
        <Input value={folder} onChange={(e) => setFolder(e.target.value)} onKeyDown={submitOnEnter} placeholder="raw/daily" />
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
