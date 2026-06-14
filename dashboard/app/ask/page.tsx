import { SectionHeader } from "@/components/common/SectionHeader";
import { AskPanel } from "@/components/ask/AskPanel";

export const metadata = { title: "Ask Vault - Agentic OS" };

export default function AskPage() {
  return (
    <main className="max-w-5xl mx-auto p-6">
      <SectionHeader
        kicker="GROUNDED RECALL"
        title="Ask Vault"
        description="Grounded question answering over the vault: hybrid retrieval (vector + keyword + link graph), answered with [n] citations into the retrieved notes."
      />
      <AskPanel />
    </main>
  );
}
