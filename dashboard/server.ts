import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer } from "ws";
import { getLiveRun, dropLiveRun } from "@/lib/runtime/liveRuns";
import { getRun, updateRun } from "@/lib/runs";
import { getIssue, updateIssue } from "@/lib/issues";
import { publish } from "@/lib/stream";
import { appendEvent } from "@/lib/threads";
import { openDb } from "@/lib/db";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();
  openDb();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url ?? "");
    const match = pathname?.match(/^\/api\/runtime\/socket\/(\d+)$/);
    if (!match) {
      console.log(`[ws] non-runtime upgrade rejected: ${pathname}`);
      socket.destroy();
      return;
    }
    const runId = parseInt(match[1], 10);
    const live = getLiveRun(runId);
    if (!live) {
      console.log(`[ws] run ${runId} not live, returning 404`);
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }
    console.log(`[ws] run ${runId} connected`);
    wss.handleUpgrade(req, socket, head, (ws) => {
      // Forward PTY → WebSocket.
      const onData = (data: string) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "data", data }));
        }
      };
      const onExit = ({ exitCode, signal }: { exitCode: number; signal?: number }) => {
        console.log(`[server.onExit] run ${runId}: exitCode=${exitCode}, signal=${signal ?? "none"}`);
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "exit", code: exitCode, signal }));
        }
        // Persist run end + transition issue. Guard against double-fire: this handler
        // can race with DELETE /api/runs/[id] which also calls dropLiveRun.
        const run = getRun(runId);
        if (run && run.endedAt == null) {
          // Treat code 0 as "agent finished cleanly, operator should review"; anything
          // else (non-zero exit, killed by signal) is a failure the operator can retry.
          const cleanExit = exitCode === 0 && !signal;
          const exitStatus = cleanExit ? "done" : "failed";
          const newIssueStatus = cleanExit ? "review" : "failed";

          updateRun(runId, { endedAt: Date.now(), exitStatus });

          const issue = getIssue(run.issueId);
          if (issue) {
            updateIssue(issue.id, { status: newIssueStatus });
            appendEvent({
              projectSlug: issue.projectSlug,
              issueId: issue.id,
              eventType: `run.${exitStatus}`,
              details: `Run ${runId} exited with code ${exitCode}${signal ? ` (signal ${signal})` : ""}`,
            });
            publish({ kind: "issue.changed", id: issue.id, projectSlug: issue.projectSlug, reason: "status" });
            publish({ kind: "thread.appended", issueId: issue.id });
          }
        }
        dropLiveRun(runId);
        if (ws.readyState === ws.OPEN) ws.close();
      };

      live.pty.onData(onData);
      live.pty.onExit(onExit);

      // Forward WebSocket → PTY.
      ws.on("message", (raw) => {
        let msg: any;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (msg.type === "data" && typeof msg.data === "string") {
          live.pty.write(msg.data);
        } else if (msg.type === "resize" && typeof msg.cols === "number" && typeof msg.rows === "number") {
          live.pty.resize(msg.cols, msg.rows);
        } else if (msg.type === "close") {
          dropLiveRun(runId);
        }
      });

      ws.on("close", () => {
        // Don't kill the PTY when the WebSocket closes; the run keeps going in the background.
        // The operator can reconnect by reopening the issue drawer.
      });
    });
  });

  server.listen(port, () => {
    console.log(`[server] http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error("[server] fatal:", err);
  process.exit(1);
});
