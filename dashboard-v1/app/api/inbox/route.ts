import { loadInbox } from "@/lib/design/loaders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const inbox = await loadInbox();
    return Response.json(inbox);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
