import { SessionList } from "@/components/sessions/SessionList";

export const dynamic = "force-dynamic";

export default function SessionsPage() {
  return (
    <main className="max-w-7xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-1">Sessions</h1>
      <p className="text-sm text-gray-500 mb-6">
        CLI transcripts from Claude Code and Gemini CLI, linked to dashboard runs where possible.
      </p>
      <SessionList />
    </main>
  );
}
