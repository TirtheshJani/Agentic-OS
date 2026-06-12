"use client";
import { Button } from "@/components/common/Button";

interface AgentDisplay {
  slug: string;
  name: string;
  skills: string[];
}

interface Props {
  crew: AgentDisplay[];
  onEditCrew: () => void;
}

export function CrewSidebar({ crew, onEditCrew }: Props) {
  return (
    <aside className="rounded-md border border-line p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink3">Crew</h2>
        <Button variant="ghost" onClick={onEditCrew}>Edit</Button>
      </header>
      {crew.length === 0 ? (
        <p className="text-sm text-ink3">No crew yet.</p>
      ) : (
        <ul className="space-y-2">
          {crew.map(a => (
            <li key={a.slug} className="text-sm">
              <div className="font-medium">{a.name}</div>
              <div className="flex gap-1 flex-wrap mt-1">
                {a.skills.slice(0, 4).map(s => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-surface2">{s}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
