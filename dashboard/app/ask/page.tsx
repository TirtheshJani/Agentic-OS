import { AskPanel } from "@/components/ask/AskPanel";

export const metadata = { title: "Ask Vault - Agentic OS" };

export default function AskPage() {
  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-1">Ask Vault</h1>
      <p className="text-sm text-ink2 mb-6">
        Grounded question answering over the vault: hybrid retrieval (vector + keyword + link graph),
        answered with [n] citations into the retrieved notes.
      </p>
      <AskPanel />
    </main>
  );
}
