import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer } from "ws";
import { getLiveRun, dropLiveRun } from "@/lib/runtime/liveRuns";
import { finalizeRunExit } from "@/lib/startRun";
import { openDb } from "@/lib/db";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

// Distinguishes our own dashboard from a foreign process squatting on the port.
async function isAgenticOsAlreadyRunning(): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/api/runtimes`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { runtimes?: unknown } | null;
    return Array.isArray(data?.runtimes);
  } catch {
    return false;
  }
}

async function main() {
  // Check BEFORE app.prepare(): two Next dev instances sharing one .next/
  // directory corrupt each other's manifests, so a second instance must
  // bail out before Next touches anything on disk.
  if (await isAgenticOsAlreadyRunning()) {
    console.log(`[server] Agentic OS is already running on port ${port}.`);
    console.log(
      `[server] Reuse that window, stop it with bin/launch-dashboard.ps1 -Stop, or set PORT to run a second instance.`
    );
    process.exit(0);
  }

  await app.prepare();
  openDb();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  // Next owns its own WebSocket upgrades: hot module reload connects to
  // /_next/webpack-hmr in dev. Hand every non-runtime upgrade to Next instead
  // of destroying the socket, or HMR (and any future Next upgrade) silently
  // breaks and code edits never reach the browser without a manual refresh.
  // Next leaves upgrade paths it does not recognize untouched, so this is safe.
  const nextUpgrade = app.getUpgradeHandler();

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url ?? "");
    const match = pathname?.match(/^\/api\/runtime\/socket\/(\d+)$/);
    if (!match) {
      void nextUpgrade(req, socket, head);
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
        // Persistence lives in finalizeRunExit (idempotent): the spawn-time
        // onExit listener in startRunForIssue usually wins; this call covers
        // runs spawned before that listener existed.
        finalizeRunExit(runId, exitCode, signal);
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

  const onListening = () => {
    console.log(`[server] http://localhost:${port}`);
    // Warm-up request: the App Router graph only boots (ensureServerBooted:
    // watcher, runtimes, auto-router, scheduler) on its first request. Fire
    // one so autonomy works even if no browser ever opens.
    setTimeout(() => {
      fetch(`http://localhost:${port}/api/runtimes`).catch((err) =>
        console.error("[server] warm-up request failed:", err)
      );
    }, 1000);
  };

  const LISTEN_RETRIES = 3;
  const LISTEN_RETRY_MS = 500;

  // Listen-time backstop for the race where another instance grabbed the
  // port after the early isAgenticOsAlreadyRunning() check in main().
  const listenWithRetry = (attempt = 0): void => {
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code !== "EADDRINUSE") {
        console.error("[server] listen failed:", err);
        process.exit(1);
      }
      if (attempt + 1 < LISTEN_RETRIES) {
        // tsx watch restarts race the old process's port release; retry briefly.
        setTimeout(() => listenWithRetry(attempt + 1), LISTEN_RETRY_MS);
        return;
      }
      void isAgenticOsAlreadyRunning().then((ours) => {
        if (ours) {
          console.log(`[server] Agentic OS is already running on port ${port}.`);
          console.log(
            `[server] Reuse that window, stop it with bin/launch-dashboard.ps1 -Stop, or set PORT to run a second instance.`
          );
          process.exit(0);
        }
        console.error(
          `[server] port ${port} is held by another process. Free it or set PORT to use a different one.`
        );
        process.exit(1);
      });
    });
    server.listen(port, onListening);
  };

  listenWithRetry();
}

main().catch((err) => {
  console.error("[server] fatal:", err);
  process.exit(1);
});
