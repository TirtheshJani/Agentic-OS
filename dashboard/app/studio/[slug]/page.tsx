import { StudioWorkspace } from "@/components/studio/StudioWorkspace";

export const dynamic = "force-dynamic";

export default async function StudioProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="max-w-7xl mx-auto p-6">
      <StudioWorkspace slug={slug} />
    </main>
  );
}
