import { listSkills } from "@/lib/skills";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  authored: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200",
  stub: "bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400",
  blocked: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200",
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
      <header className="flex items-baseline justify-between mb-6">
        <h1 className="text-xl font-semibold">Skills</h1>
        <span className="text-sm text-gray-500">{skills.length} skills</span>
      </header>

      {Array.from(domains.entries()).map(([domain, items]) => (
        <section key={domain} className="mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            {domain} <span className="text-gray-400 normal-case">({items.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((s) => (
              <article
                key={s.folder}
                className="rounded-md border border-gray-200 dark:border-gray-800 p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{s.name}</h3>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLES[s.status] ?? STATUS_STYLES.stub}`}
                  >
                    {s.status}
                  </span>
                </div>
                <p className="text-gray-500 mt-1 line-clamp-3">{s.description}</p>
                <div className="flex gap-2 mt-2 text-[10px] text-gray-400 font-mono">
                  <span>{s.folder}</span>
                  {s.mcpServer && s.mcpServer !== "none" && <span>mcp:{s.mcpServer}</span>}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
