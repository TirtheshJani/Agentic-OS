import { loadMcpServers } from "@/lib/mcp-loader";

export const dynamic = "force-dynamic";

export function GET() {
  const servers = loadMcpServers();
  return Response.json({ servers });
}
