import { Starfield } from "@/components/starfield";
import { Header } from "@/components/header";
import { RunStateProvider } from "@/components/run-state";
import { TaskChain } from "@/components/task-chain";
import { TaskThread } from "@/components/task-thread";
import { getTask } from "@/lib/tasks";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) notFound();
  const task = getTask(n);
  if (!task) notFound();

  return (
    <RunStateProvider>
      <Starfield />
      <Header />
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="border border-border rounded-md bg-card/60 px-3 py-2">
          <div className="mono-label text-muted-foreground">TASK · {task.id}</div>
          <div className="text-sm font-mono mt-1">{task.prompt}</div>
          <div className="text-xs text-muted-foreground mt-2 font-mono">
            assignee: {task.assignee} · status: {task.status} · dept: {task.department ?? "—"}
          </div>
        </div>
        <TaskChain taskId={task.id} />
        <TaskThread taskId={task.id} />
      </main>
    </RunStateProvider>
  );
}
