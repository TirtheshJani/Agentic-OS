import { listSkills } from "@/lib/skills";
import { Card } from "@/components/common/Card";
import { Pill } from "@/components/common/Pill";
import { SectionHeader } from "@/components/common/SectionHeader";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, "ok" | "warn" | "danger" | "neutral"> = {
  authored: "ok",
  stub: "warn",
  blocked: "danger",
};

export default function SkillsPage() {
  const skills = listSkills();
  const domains = new Map<string, typeof skills>();
  for (const s of skills) {
    if (!domains.has(s.domain)) domains.set(s.domain, []);
    domains.get(s.domain)!.push(s);
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <SectionHeader
        kicker="INVENTORY"
        title="Skills"
        action={<span className="text-sm text-ink3">{skills.length} skills</span>}
      />

      {Array.from(domains.entries()).map(([domain, items]) => (
        <section key={domain} className="mb-8">
          <h2 className="font-label text-sm uppercase tracking-wide text-ink3 mb-3">
            {domain} <span className="text-ink3 normal-case">({items.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((s) => (
              <Card
                key={s.folder}
                className="p-3 text-sm transition-colors hover:border-accent-line"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-semibold text-ink">{s.name}</h3>
                  <Pill tone={STATUS_TONES[s.status] ?? "neutral"} className="shrink-0">
                    {s.status}
                  </Pill>
                </div>
                <p className="text-ink2 mt-1 line-clamp-3">{s.description}</p>
                <div className="flex gap-2 mt-2 text-[10px] text-ink3 font-mono">
                  <span>{s.folder}</span>
                  {s.mcpServer && s.mcpServer !== "none" && <span>mcp:{s.mcpServer}</span>}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
