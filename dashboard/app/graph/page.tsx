import { EmptyState } from "@/components/common/EmptyState";

export default function GraphPage() {
  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6">Knowledge Graph</h1>
      <EmptyState
        title="Graph ships with the knowledge layer phase"
        description="An interactive map of vault notes, wikilinks, and tags will render here."
      />
    </main>
  );
}
