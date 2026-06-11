"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/common/Button";
import { Drawer } from "@/components/common/Drawer";
import { EmptyState } from "@/components/common/EmptyState";
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
      <h1 className="text-xl font-semibold mb-1">Docker</h1>
      <p className="text-sm text-gray-500 mb-6">
        Compose stacks and containers. Lifecycle actions only work for allowlisted projects (Settings).
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-500">Loading...</p>}

      {data && !data.available.cli && (
        <EmptyState title="Docker not installed" description="No docker binary found on PATH." />
      )}
      {data && data.available.cli && !data.available.daemon && (
        <EmptyState title="Docker daemon not running" description="Start Docker Desktop, then refresh." />
      )}

      {data && data.available.daemon && (
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold mb-2">Compose stacks</h2>
            {data.stacks.length === 0 ? (
              <p className="text-sm text-gray-500">No compose stacks.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {data.stacks.map((s) => {
                  const allowed = data.allowlist.includes(s.name);
                  return (
                    <div key={s.name} className="rounded-md border border-gray-200 dark:border-gray-800 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{s.name}</span>
                        <span className="text-xs text-gray-500">{s.status}</span>
                      </div>
                      <div className="text-xs text-gray-400 truncate" title={s.configFiles}>
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
            <h2 className="text-sm font-semibold mb-2">Containers</h2>
            {data.containers.length === 0 ? (
              <p className="text-sm text-gray-500">No containers.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
                    <th className="py-1.5 pr-2">Name</th>
                    <th className="py-1.5 pr-2">Image</th>
                    <th className="py-1.5 pr-2">State</th>
                    <th className="py-1.5 pr-2">Project</th>
                    <th className="py-1.5 pr-2">Ports</th>
                    <th className="py-1.5 pr-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.containers.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100 dark:border-gray-900">
                      <td className="py-1.5 pr-2">{c.name}</td>
                      <td className="py-1.5 pr-2 max-w-48 truncate" title={c.image}>
                        {c.image}
                      </td>
                      <td className="py-1.5 pr-2">
                        <span
                          className={
                            c.state === "running"
                              ? "rounded bg-green-100 dark:bg-green-950 px-1.5 py-0.5 text-xs text-green-700 dark:text-green-300"
                              : "rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs text-gray-600 dark:text-gray-400"
                          }
                        >
                          {c.state}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2">{c.composeProject ?? ""}</td>
                      <td className="py-1.5 pr-2 text-xs text-gray-500">{c.ports}</td>
                      <td className="py-1.5 pr-2">
                        <Button onClick={() => setLogTarget(c)}>Logs</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      {logTarget && (
        <Drawer title={`Logs: ${logTarget.name}`} onClose={() => setLogTarget(null)}>
          <pre className="text-xs whitespace-pre-wrap p-3 overflow-auto max-h-[70vh] bg-gray-50 dark:bg-gray-900 rounded">
            {logs || "Loading logs..."}
          </pre>
        </Drawer>
      )}
    </main>
  );
}
