import { NotesPanel } from "@/components/notes/NotesPanel";

export const metadata = { title: "Notes - Agentic OS" };

export default function NotesPage() {
  return (
    <main className="max-w-7xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-1">Notes</h1>
      <p className="text-sm text-ink2 mb-4">
        Read and edit vault notes. Quick capture from anywhere with Ctrl+Shift+K.
      </p>
      <NotesPanel />
    </main>
  );
}
