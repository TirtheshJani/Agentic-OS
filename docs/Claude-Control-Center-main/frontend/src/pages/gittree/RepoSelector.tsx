import { ChevronDown } from 'lucide-react';
import type { GitRepo } from '../../types';

export function RepoSelector({
  repos,
  selected,
  onChange,
}: {
  repos: GitRepo[];
  selected: string | null;
  onChange: (id: string) => void;
}) {
  const selectedRepo = repos.find((r) => r.id === selected);

  return (
    <div className="relative" style={{ minWidth: 200 }}>
      <div
        className="input-field flex items-center justify-between cursor-pointer"
        style={{ userSelect: 'none' }}
      >
        <span className="text-sm" style={{ color: selectedRepo ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
          {selectedRepo ? selectedRepo.name : 'Select repo…'}
        </span>
        <ChevronDown size={13} style={{ color: 'var(--text-tertiary)', marginLeft: 8 }} />
      </div>
      <select
        className="absolute inset-0 opacity-0 w-full cursor-pointer"
        value={selected ?? ''}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      >
        <option value="">Select repo…</option>
        {repos.map((r, i) => (
          <option key={`${r.id}-${i}`} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}
