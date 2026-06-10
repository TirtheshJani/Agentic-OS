import { EmptyState } from "@/components/common/EmptyState";

export default function AgentsPage() {
  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6">Agents</h1>
      <EmptyState
        title="Agent creator ships in the next phase"
        description="Browse, create, and edit agent profiles here, including an AI-drafted starting point."
      />
    </main>
  );
}
