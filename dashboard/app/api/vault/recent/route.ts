import { recentVaultChanges } from "@/lib/db";
import { startVaultWatcher } from "@/lib/vault-watcher";

export const dynamic = "force-dynamic";

export async function GET() {
  startVaultWatcher();
  return Response.json({ changes: recentVaultChanges(8) });
}
