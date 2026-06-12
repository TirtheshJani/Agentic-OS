import { ResearchDetail } from "@/components/research/ResearchDetail";

export const dynamic = "force-dynamic";

export default async function ResearchDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="max-w-7xl mx-auto p-6">
      <ResearchDetail slug={slug} />
    </main>
  );
}
