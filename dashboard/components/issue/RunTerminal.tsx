"use client";
import { useEffect, useRef } from "react";
import type { Terminal } from "xterm";
import type { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

interface Props {
  runId: number;
  active: boolean; // when false, don't auto-scroll on output
}

export function RunTerminal({ runId, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      // xterm references `self` at module scope, so it must only ever load in
      // the browser. A static import breaks SSR of any page that can render
      // this component (e.g. /issues, /projects/[slug] on direct load).
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import("xterm"),
        import("xterm-addon-fit"),
        import("xterm-addon-web-links"),
      ]);
      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        convertEol: true,
        cursorBlink: true,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Mono", "Liberation Mono", monospace',
        fontSize: 13,
        theme: {
          background: "#0b0b0d",
          foreground: "#e6e6e6",
          cursor: "#e6e6e6",
        },
      });
      const fit = new FitAddon();
      const links = new WebLinksAddon();
      term.loadAddon(fit);
      term.loadAddon(links);
      term.open(containerRef.current);
      fit.fit();

      termRef.current = term;
      fitRef.current = fit;

      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/api/runtime/socket/${runId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "data") term.write(msg.data);
          else if (msg.type === "exit") {
            term.write(`\r\n[Process exited with code ${msg.code}]\r\n`);
          }
        } catch {
          // ignore
        }
      };
      ws.onclose = () => {
        term.write("\r\n[Disconnected]\r\n");
      };

      term.onData((data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "data", data }));
        }
      });

      const onResize = () => {
        try {
          fit.fit();
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
          }
        } catch {
          // ignore
        }
      };
      window.addEventListener("resize", onResize);

      cleanup = () => {
        window.removeEventListener("resize", onResize);
        try { ws.close(); } catch {}
        try { term.dispose(); } catch {}
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
      cleanup = null;
      termRef.current = null;
      wsRef.current = null;
      fitRef.current = null;
    };
  }, [runId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[400px] rounded-card border border-line2 bg-black p-1"
    />
  );
}
