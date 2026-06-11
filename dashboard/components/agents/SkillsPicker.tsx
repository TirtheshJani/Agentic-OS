"use client";
import { useMemo, useState } from "react";

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
        <div className="flex gap-1 flex-wrap">
          {selected.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            >
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => onToggle(name)}
                className="hover:opacity-70"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search skills..."
        className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm w-full"
      />
      <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-800">
        {groups.length === 0 && (
          <p className="p-3 text-xs text-gray-400">No skills match &quot;{query}&quot;.</p>
        )}
        {groups.map(([domain, skills]) => (
          <div key={domain}>
            <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-800">
              {domain}
            </div>
            {skills.map((s) => (
              <label
                key={s.name}
                className="flex items-start gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selected.includes(s.name)}
                  onChange={() => onToggle(s.name)}
                />
                <span className="min-w-0">
                  <span className="font-medium">{s.name}</span>
                  {s.description && (
                    <span className="block text-gray-500 truncate" title={s.description}>
                      {s.description}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
