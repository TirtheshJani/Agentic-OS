import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { VAULT_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rel = searchParams.get("path");
  if (!rel) return NextResponse.json({ error: "path required" }, { status: 400 });

  // Path-traversal guard: the resolved file must stay inside the vault.
  const abs = path.resolve(VAULT_DIR, rel);
  if (!abs.startsWith(path.resolve(VAULT_DIR) + path.sep)) {
    return NextResponse.json({ error: "path outside vault" }, { status: 400 });
  }
  if (!abs.endsWith(".md") || !fs.existsSync(abs)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ path: rel, content: fs.readFileSync(abs, "utf8") });
}
