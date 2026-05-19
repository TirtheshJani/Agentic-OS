import { Starfield } from "@/components/starfield";
import { Header } from "@/components/header";
import { RunStateProvider } from "@/components/run-state";
import { IssueForm } from "@/components/issue-form";
import { loadProjects } from "@/lib/projects-loader";
import { loadAgents } from "@/lib/agents-loader";

export const dynamic = "force-dynamic";

export default function NewIssuePage() {
  // Loaded server-side so the form can mount with the full picker data
  // already in props (no client-side fetch round-trip). Mirrors the
  // existing workbench loaders.
  const projects = loadProjects();
  const agents = loadAgents();
  return (
    <RunStateProvider>
      <Starfield />
      <Header />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="border border-border rounded-md bg-card/60 px-3 py-2">
          <div className="mono-label text-muted-foreground">NEW ISSUE</div>
          <div className="text-sm font-mono mt-1">
            File work for an agent or yourself. Filed issues land in
            <span className="text-foreground"> backlog</span> until promoted to
            <span className="text-foreground"> queued</span>.
          </div>
        </div>
        <IssueForm projects={projects} agents={agents} />
      </main>
    </RunStateProvider>
  );
}
