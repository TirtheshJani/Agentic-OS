import {
  executeRun,
  validateRunInput,
  type RunExecutionEvent,
  type RunExecutionInput,
} from "@/lib/run-execution";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: RunExecutionInput;
  try {
    body = (await req.json()) as RunExecutionInput;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  // Validate up front so we can return real HTTP status codes (404, 412, 400)
  // instead of streaming an error event. executeRun re-validates internally
  // and throws RunValidationError, but the route handler is the only caller
  // that wants HTTP semantics so the second pass is intentional.
  const validation = validateRunInput(body);
  if (!validation.ok) {
    switch (validation.error.kind) {
      case "unknown-skill":
        return Response.json({ error: "unknown skill" }, { status: 404 });
      case "unknown-team":
        return Response.json({ error: "unknown team" }, { status: 404 });
      case "team-path-missing":
        return Response.json(
          { error: `team path missing: ${validation.error.path}` },
          { status: 412 }
        );
      case "missing-prompt":
        return Response.json(
          { error: "either skillSlug or prompt required" },
          { status: 400 }
        );
    }
  }

  const encoder = new TextEncoder();
  // AbortController lets the stream's cancel() callback signal the runClaude
  // generator (via executeRun's signal option) to stop pulling from the
  // child process. Combined with the `closed` flag, this guarantees that:
  //   1. enqueue() after client disconnect cannot throw the SSE error
  //   2. the spawned `claude` child does not outlive the HTTP connection
  const streamAbort = new AbortController();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: RunExecutionEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Client disconnected between the closed check and enqueue. Flip
          // the flag so subsequent sends short-circuit cheaply.
          closed = true;
        }
      };

      // Merge req.signal (Next.js client disconnect) with streamAbort
      // (ReadableStream.cancel) so either path tears the subprocess down.
      const onAbort = () => streamAbort.abort();
      if (req.signal.aborted) streamAbort.abort();
      else req.signal.addEventListener("abort", onAbort);

      try {
        await executeRun(body, {
          signal: streamAbort.signal,
          onEvent: (evt) => {
            if (!closed) send(evt);
          },
        });
      } catch (e) {
        // executeRun handles its own validation and subprocess errors
        // (emitting events + finishRun). A throw here means something
        // unexpected (e.g. a synchronous bug). Surface to the client.
        if (!closed) {
          send({
            type: "error",
            data: { message: e instanceof Error ? e.message : String(e) },
          });
        }
      } finally {
        req.signal.removeEventListener("abort", onAbort);
        if (!closed) {
          try {
            controller.close();
          } catch {
            // already closed by cancel()
          }
        }
      }
    },
    cancel() {
      // Client closed the SSE stream. Mark the stream as closed so any
      // in-flight enqueue from the producer short-circuits, then signal the
      // child subprocess via executeRun's AbortSignal hook.
      closed = true;
      streamAbort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
