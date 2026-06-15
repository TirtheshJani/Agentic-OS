"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/common/Button";
import { Drawer } from "@/components/common/Drawer";
import { EmptyState } from "@/components/common/EmptyState";
import { SectionHeader } from "@/components/common/SectionHeader";
import { StatusDot } from "@/components/common/StatusDot";
import { Pill } from "@/components/common/Pill";
import type { DockerStack, DockerContainer } from "@/lib/docker";

interface DockerData {
  available: { cli: boolean; daemon: boolean; version?: string };
  stacks: DockerStack[];
  containers: DockerContainer[];
  allowlist: string[];
}

export default function DockerPage() {
  const [data, setData] = useState<DockerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [logTarget, setLogTarget] = useState<DockerContainer | null>(null);
  const [logs, setLogs] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/docker", { cache: "no-store" });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`);
      setData((await res.json()) as DockerData);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!logTarget) return;
    let cancelled = false;
    const fetchLogs = async () => {
      const res = await fetch(`/api/docker/containers/${logTarget.id}/logs`, { cache: "no-store" });
      if (res.ok && !cancelled) setLogs(((await res.json()) as { logs: string }).logs);
    };
    void fetchLogs();
    const t = setInterval(fetchLogs, 3_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [logTarget]);

  async function act(stack: string, action: "start" | "stop" | "restart") {
    setBusy(`${stack}:${action}`);
    try {
      const res = await fetch(`/api/docker/stacks/${encodeURIComponent(stack)}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="max-w-7xl mx-auto p-6">
      <SectionHeader
        kicker="CONTAINERS"
        title="Docker"
        description="Compose stacks and containers. Lifecycle actions only work for allowlisted projects (Settings)."
      />

      {error && <p className="text-sm text-danger mb-4">{error}</p>}
      {!data && !error && <p className="text-sm text-ink3">Loading...</p>}

      {data && !data.available.cli && (
        <EmptyState title="Docker not installed" description="No docker binary found on PATH." />
      )}
      {data && data.available.cli && !data.available.daemon && (
        <EmptyState title="Docker daemon not running" description="Start Docker Desktop, then refresh." />
      )}

      {data && data.available.daemon && (
        <div className="space-y-6">
          <section>
            <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-2">Compose stacks</h2>
            {data.stacks.length === 0 ? (
              <p className="text-sm text-ink3">No compose stacks.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {data.stacks.map((s) => {
                  const allowed = data.allowlist.includes(s.name);
                  const running = /running|up/i.test(s.status);
                  return (
                    <div
                      key={s.name}
                      className="rounded-card border border-line bg-surface p-3 transition-colors hover:border-accent-line"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{s.name}</span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink3">
                          <StatusDot tone={running ? "ok" : "neutral"} pulse={running} />
                          {s.status}
                        </span>
                      </div>
                      <div className="text-xs text-ink3 truncate" title={s.configFiles}>
                        {s.configFiles}
                      </div>
                      <div className="flex gap-2 mt-2">
                        {(["start", "stop", "restart"] as const).map((a) => (
                          <Button
                            key={a}
                            onClick={() => act(s.name, a)}
                            disabled={!allowed || busy !== null}
                            title={allowed ? undefined : "Not on the allowlist (Settings)"}
                          >
                            {busy === `${s.name}:${a}` ? "..." : a}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-2">Containers</h2>
            {data.containers.length === 0 ? (
              <p className="text-sm text-ink3">No containers.</p>
            ) : (
              <div className="rounded-card border border-line bg-surface overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-line font-label uppercase tracking-wide text-[10px] text-ink3">
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Image</th>
                    <th className="py-2 px-3">State</th>
                    <th className="py-2 px-3">Project</th>
                    <th className="py-2 px-3">Ports</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.containers.map((c) => {
                    const isRunning = c.state === "running";
                    return (
                    <tr key={c.id} className="border-b border-line transition-colors hover:bg-surface2">
                      <td className="py-2 px-3 font-mono text-ink2">{c.name}</td>
                      <td className="py-2 px-3 max-w-48 truncate text-ink2" title={c.image}>
                        {c.image}
                      </td>
                      <td className="py-2 px-3">
                        <Pill tone={isRunning ? "ok" : "neutral"}>
                          <StatusDot tone={isRunning ? "ok" : "neutral"} pulse={isRunning} />
                          {c.state}
                        </Pill>
                      </td>
                      <td className="py-2 px-3">{c.composeProject ?? ""}</td>
                      <td className="py-2 px-3 text-xs text-ink3 font-mono">{c.ports}</td>
                      <td className="py-2 px-3">
                        <Button onClick={() => setLogTarget(c)}>Logs</Button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </section>
        </div>
      )}

      {logTarget && (
        <Drawer title={`Logs: ${logTarget.name}`} onClose={() => setLogTarget(null)}>
          <pre className="font-mono text-xs whitespace-pre-wrap p-3 overflow-auto max-h-[70vh] bg-raise rounded-card border border-line">
            {logs || "Loading logs..."}
          </pre>
        </Drawer>
      )}
    </main>
  );
}
