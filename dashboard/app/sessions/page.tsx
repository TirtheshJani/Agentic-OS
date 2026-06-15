import { SectionHeader } from "@/components/common/SectionHeader";
import { SessionList } from "@/components/sessions/SessionList";

export const dynamic = "force-dynamic";

export default function SessionsPage() {
  return (
    <main className="max-w-7xl mx-auto p-6">
      <SectionHeader
        kicker="TRANSCRIPTS"
        title="Sessions"
        description="CLI transcripts from Claude Code and Gemini CLI, linked to dashboard runs where possible."
      />
      <SessionList />
    </main>
  );
}
