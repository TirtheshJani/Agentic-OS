"use client";
import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Field, Input } from "@/components/common/Field";
import { Button } from "@/components/common/Button";

interface Props {
  mode: "link" | "clone";
  onClose: () => void;
}

export function NewProjectDialog({ mode, onClose }: Props) {
  const [name, setName] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const payload =
      mode === "link"
        ? { mode, name, folderPath }
        : { mode, name, repoUrl };

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = name.length > 0 && (mode === "link" ? folderPath.length > 0 : repoUrl.length > 0);
  const title = mode === "link" ? "Link existing folder" : "Clone from GitHub";

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? "Working..." : title}
          </Button>
        </>
      }
    >
      <Field label="Project name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="QML Healthcare Diagnostics"
          autoFocus
        />
      </Field>

      {mode === "link" ? (
        <Field label="Folder path" hint="Absolute path on your machine">
          <Input
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="/Users/tj/code/qml-healthcare-diagnostics"
          />
        </Field>
      ) : (
        <Field label="GitHub URL" hint="HTTPS or SSH form, both work">
          <Input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/TirtheshJani/qml-healthcare-diagnostics"
          />
        </Field>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
