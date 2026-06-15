import { SectionHeader } from "@/components/common/SectionHeader";
import { NotesPanel } from "@/components/notes/NotesPanel";

export const metadata = { title: "Notes - Agentic OS" };

export default function NotesPage() {
  return (
    <main className="max-w-7xl mx-auto p-6">
      <SectionHeader
        kicker="VAULT"
        title="Notes"
        description="Read and edit vault notes. Quick capture from anywhere with Ctrl+Shift+K."
      />
      <NotesPanel />
    </main>
  );
}
