"use client";
import { useRuntimes } from "@/hooks/useRuntimes";
import { SectionHeader } from "@/components/common/SectionHeader";
import { RuntimeCard } from "@/components/runtimes/RuntimeCard";

export default function RuntimesPage() {
  const runtimes = useRuntimes();
  const online = runtimes?.filter((r) => r.availability.available).length ?? 0;
  const total = runtimes?.length ?? 0;

  return (
    <main className="max-w-5xl mx-auto p-6">
      <SectionHeader
        kicker="ENGINES"
        title="Runtimes"
        description="Agent runtime CLIs detected on this machine and what each one can do."
        action={
          runtimes ? (
            <span className="rounded-pill border border-line2 bg-surface px-3 py-1 font-mono text-xs text-ink2">
              <span className="text-ok">{online}</span>
              <span className="text-ink3"> / {total} online</span>
            </span>
          ) : undefined
        }
      />
      {!runtimes ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-card border border-line bg-surface2" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {runtimes.map((rt, i) => (
            <RuntimeCard key={rt.id} runtime={rt} index={i} />
          ))}
        </div>
      )}
    </main>
  );
}
