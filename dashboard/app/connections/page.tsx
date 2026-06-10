import { EmptyState } from "@/components/common/EmptyState";

export default function ConnectionsPage() {
  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6">Connections</h1>
      <EmptyState
        title="Connections hub ships with the integrations phase"
        description="Login status for Claude, Gemini, GitHub, and MCP-backed accounts (Gmail, Calendar) will show here. LinkedIn is a deferred connector slot."
      />
    </main>
  );
}
