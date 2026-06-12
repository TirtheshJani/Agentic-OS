"use client";
import { useEffect, useState, useCallback } from "react";
import { Drawer } from "@/components/common/Drawer";
import { Button } from "@/components/common/Button";
import { IssueHeader } from "./IssueHeader";
import { IssueBodyEditor } from "./IssueBodyEditor";
import { ThreadList } from "./ThreadList";
import { ThreadComposer } from "./ThreadComposer";
import { RunsTab } from "./RunsTab";
import { useStream } from "@/hooks/useStream";

interface IssueData {
  id: number;
  projectSlug: string;
  title: string;
  body: string;
  assigneeSlug: string | null;
  status: "backlog" | "queued" | "running" | "review" | "done" | "failed";
  mode: "sync" | "async";
  priority: number;
  labels: string[];
}

interface AgentDisplay {
  slug: string;
  name: string;
}

interface Props {
  issueId: number;
  crew: AgentDisplay[];
  onClose: () => void;
}

export function IssueDrawer({ issueId, crew, onClose }: Props) {
  const [issue, setIssue] = useState<IssueData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/issues/${issueId}`, { cache: "no-store" });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      setIssue(await res.json());
    } catch (err) {
      console.error("Failed to load issue:", err);
      setError("Network error");
    }
  }, [issueId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useStream((event) => {
    if (event.kind === "issue.changed" && (event as any).id === issueId) reload();
  });

  async function patch(p: Partial<IssueData>) {
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (res.ok) setIssue(await res.json());
    } catch (err) {
      console.error("Failed to patch issue:", err);
    }
  }

  async function deleteIssue() {
    if (!confirm("Delete this issue?")) return;
    try {
      const res = await fetch(`/api/issues/${issueId}`, { method: "DELETE" });
      if (res.ok) onClose();
    } catch (err) {
      console.error("Failed to delete issue:", err);
    }
  }

  if (error) {
    return (
      <Drawer title="Issue" width="lg" onClose={onClose}>
        <p className="text-sm text-danger">{error}</p>
      </Drawer>
    );
  }
  if (!issue) {
    return (
      <Drawer title="Issue" width="lg" onClose={onClose}>
        <p className="text-sm text-ink3">Loading...</p>
      </Drawer>
    );
  }

  return (
    <Drawer
      title={`Issue #${issue.id}`}
      width="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" onClick={deleteIssue}>Delete</Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </>
      }
    >
      <section className="space-y-4">
        <IssueHeader issue={issue} crew={crew} onPatch={patch} />
      </section>

      <hr className="my-6 border-line" />

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink3 mb-3">Runs</h3>
        <RunsTab
          issueId={issue.id}
          projectSlug={issue.projectSlug}
          issueStatus={issue.status}
          hasAssignee={issue.assigneeSlug != null}
        />
      </section>

      <hr className="my-6 border-line" />

      <section>
        <IssueBodyEditor title={issue.title} body={issue.body} onSave={patch} />
      </section>

      <hr className="my-6 border-line" />

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink3 mb-3">Thread</h3>
        <ThreadList issueId={issue.id} />
        <div className="mt-3">
          <ThreadComposer issueId={issue.id} />
        </div>
      </section>
    </Drawer>
  );
}
