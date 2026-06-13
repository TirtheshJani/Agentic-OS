"use client";
import { useState } from "react";
import { Button } from "@/components/common/Button";

interface Props {
  projectSlug: string;
  repo?: string | null;
}

// Pull-on-demand GitHub import for the selected project. Visible only when the
// project has a GitHub repo-url; the board reloads itself on the issue.changed
// event the import API publishes.
export function ImportGitHubButton({ projectSlug, repo }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!repo || !repo.startsWith("https://github.com/")) return null;

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/github/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ? `Import failed: ${data.error}` : "Import failed");
      } else {
        setMsg(`Imported ${data.imported}, updated ${data.updated}, skipped ${data.skipped}`);
      }
    } catch {
      setMsg("Import failed: network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" onClick={run} disabled={busy} title={`Import issues from ${repo}`}>
        {busy ? "Importing…" : "Import from GitHub"}
      </Button>
      {msg && <span className="text-xs text-ink3">{msg}</span>}
    </div>
  );
}
