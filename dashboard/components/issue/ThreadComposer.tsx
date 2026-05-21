"use client";
import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Textarea } from "@/components/common/Field";

interface Props {
  issueId: number;
}

export function ThreadComposer({ issueId }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/thread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) setText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment..."
      />
      <div className="flex justify-end">
        <Button variant="primary" onClick={submit} disabled={submitting || text.trim().length === 0}>
          {submitting ? "Posting..." : "Comment"}
        </Button>
      </div>
    </div>
  );
}
