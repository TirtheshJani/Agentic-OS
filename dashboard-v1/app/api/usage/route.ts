import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const dynamic = "force-dynamic";

type UsageWindow = { used: number; limit: number; resets_at: string | null };

function readUsageFile(): { five_hour: UsageWindow; weekly: UsageWindow } | null {
  const candidates = [
    path.join(os.homedir(), ".claude", "usage.json"),
    path.join(os.homedir(), ".config", "claude", "usage.json"),
  ];
  for (const p of candidates) {
    try {
      const raw = fs.readFileSync(p, "utf8");
      return JSON.parse(raw);
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET() {
  const usage = readUsageFile();
  if (!usage) {
    return Response.json({
      available: false,
      five_hour: null,
      weekly: null,
    });
  }
  return Response.json({ available: true, ...usage });
}
