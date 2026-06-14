import { SectionHeader } from "@/components/common/SectionHeader";
import { SessionDetail } from "@/components/sessions/SessionDetail";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="max-w-5xl mx-auto p-6">
      <SectionHeader kicker="TRANSCRIPTS" title="Session" />
      <SessionDetail id={id} />
    </main>
  );
}
