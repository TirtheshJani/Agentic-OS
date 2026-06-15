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

function initials(slug: string): string {
  return slug
    .split("-")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// Deterministic avatar tint per crew member so the stack is stable across renders.
const AVATAR_BG = ["#2a5d8f", "#3a7a4f", "#7a5a8f", "#8f6a2a", "#2a8f8a", "#8f3a5a"];
function avatarColor(slug: string): string {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_BG[h % AVATAR_BG.length];
}

export function CrewSidebar({ crew, onEditCrew }: Props) {
  return (
    <aside className="rounded-card border border-line bg-surface p-4 shadow-card">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-label text-[11px] uppercase tracking-[0.16em] text-ink3">Crew</h2>
        <Button variant="ghost" onClick={onEditCrew}>Edit</Button>
      </header>
      {crew.length === 0 ? (
        <p className="text-sm text-ink3">No crew yet.</p>
      ) : (
        <ul className="space-y-3">
          {crew.map((a) => (
            <li key={a.slug} className="flex items-start gap-2.5 text-sm">
              <span
                title={a.name}
                style={{ background: avatarColor(a.slug) }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-label text-[10px] text-white"
              >
                {initials(a.slug)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink">{a.name}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {a.skills.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      className="rounded-pill bg-surface2 px-1.5 py-0.5 font-label text-[9px] uppercase tracking-wide text-ink3"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
