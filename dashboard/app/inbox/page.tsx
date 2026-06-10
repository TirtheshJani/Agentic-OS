import { EmptyState } from "@/components/common/EmptyState";

export default function InboxPage() {
  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6">Inbox</h1>
      <EmptyState
        title="Inbox ships with the connections phase"
        description="Triage digests from vault/raw/daily, failed runs, and issues in review will surface here."
      />
    </main>
  );
}
