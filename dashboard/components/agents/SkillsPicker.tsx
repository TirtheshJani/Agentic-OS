"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Pill } from "@/components/common/Pill";

export interface SkillOption {
  name: string;
  domain: string;
  description: string;
}

interface Props {
  options: SkillOption[];
  selected: string[];
  onToggle: (name: string) => void;
}

/**
 * Searchable, domain-grouped skill picker with removable chips for the
 * current selection. Purely presentational; name-or-domain validation
 * stays server-side in agentMutations.
 */
export function SkillsPicker({ options, selected, onToggle }: Props) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? options.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.domain.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q)
        )
      : options;
    const byDomain = new Map<string, SkillOption[]>();
    for (const s of filtered) {
      const list = byDomain.get(s.domain) ?? [];
      list.push(s);
      byDomain.set(s.domain, list);
    }
    return [...byDomain.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [options, query]);

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {selected.map((name) => (
            <Pill key={name} tone="accent" className="border border-accent-line">
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => onToggle(name)}
                className="hover:opacity-70"
              >
                ×
              </button>
            </Pill>
          ))}
        </div>
      )}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search skills..."
        className="w-full rounded-card border border-line2 bg-surface2 text-ink px-3 py-1.5 text-sm focus:border-accent-line focus:outline-none"
      />
      <div className="max-h-56 overflow-y-auto rounded-card border border-line bg-surface">
        {groups.length === 0 && (
          <p className="p-3 text-xs text-ink3">No skills match &quot;{query}&quot;.</p>
        )}
        {groups.map(([domain, skills]) => (
          <div key={domain}>
            <div className="sticky top-0 bg-raise px-2.5 py-1 font-label text-[10px] uppercase tracking-wide text-ink3 border-b border-line">
              {domain}
            </div>
            {skills.map((s) => {
              const isSelected = selected.includes(s.name);
              return (
                <label
                  key={s.name}
                  className={clsx(
                    "flex items-start gap-2 px-2.5 py-1.5 text-xs cursor-pointer border-l-2 transition-colors",
                    isSelected
                      ? "border-accent-line bg-accent-bg"
                      : "border-transparent hover:bg-surface2"
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[var(--accent)]"
                    checked={isSelected}
                    onChange={() => onToggle(s.name)}
                  />
                  <span className="min-w-0">
                    <span className={clsx("font-medium", isSelected ? "text-accent-ink" : "text-ink")}>{s.name}</span>
                    {s.description && (
                      <span className="block text-ink3 truncate" title={s.description}>
                        {s.description}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
