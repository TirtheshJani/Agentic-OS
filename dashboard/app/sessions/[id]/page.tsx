import { SessionDetail } from "@/components/sessions/SessionDetail";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6">Session</h1>
      <SessionDetail id={id} />
    </main>
  );
}
