"use client";
import { useState } from "react";
import { Button } from "@/components/common/Button";

interface Props {
  runId: number;
  onStopped: () => void;
}

export function StopButton({ runId, onStopped }: Props) {
  const [busy, setBusy] = useState(false);

  async function stop() {
    if (!confirm("Stop the running agent? This cannot be resumed.")) return;
    setBusy(true);
    try {
      await fetch(`/api/runs/${runId}`, { method: "DELETE" });
      onStopped();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="danger" onClick={stop} disabled={busy}>
      {busy ? "Stopping..." : "Stop"}
    </Button>
  );
}
