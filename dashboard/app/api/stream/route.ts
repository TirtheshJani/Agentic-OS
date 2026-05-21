import { subscribe, type StreamEvent } from "@/lib/stream";
import { ensureServerBooted } from "@/lib/server-init";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await ensureServerBooted();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: StreamEvent | { kind: "ping" }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Initial ping so the client sees a successful connection.
      send({ kind: "ping" });

      const unsubscribe = subscribe(event => send(event));

      // Keepalive ping every 25s; some proxies kill idle SSE connections.
      const interval = setInterval(() => send({ kind: "ping" }), 25_000);

      // Clean up when the client disconnects. Next.js exposes this via the
      // ReadableStream cancel callback.
      (controller as any)._cleanup = () => {
        clearInterval(interval);
        unsubscribe();
      };
    },
    cancel(controller) {
      (controller as any)._cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
