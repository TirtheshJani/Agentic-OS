import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useMemoryList } from '../../hooks/useMemory';
import { useUIStore } from '../../store/uiStore';
import { MemoryCard } from './MemoryCard';
import { MemoryEditor } from './MemoryEditor';

const ALL_TYPES = ['user', 'feedback', 'project', 'reference'];

interface Props {
  projectId: string;
}

export function MemoryList({ projectId }: Props) {
  const { data: files, isLoading, error } = useMemoryList(projectId);
  const { openMemoryEditor } = useUIStore();
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<string | null>(null);

  const filtered = files?.filter((f) => {
    const matchType = !activeType || f.type === activeType;
    const matchSearch =
      !search ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.description.toLowerCase().includes(search.toLowerCase()) ||
      f.body.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-tertiary)' }} />
          <input
            className="input-field pl-8 w-full"
            placeholder="Search memories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Type filters */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveType(null)}
            className="chip transition-all"
            style={{
              background: !activeType ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
              color: !activeType ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            All
          </button>
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(activeType === t ? null : t)}
              className="chip capitalize transition-all"
              style={{
                background: activeType === t ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
                color: activeType === t ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <button
          onClick={() => openMemoryEditor(projectId, null)}
          className="btn-primary"
        >
          <Plus size={13} />
          New
        </button>
      </div>

      {/* Grid */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="card p-6 text-center">
          <p className="text-sm" style={{ color: 'var(--error)' }}>Failed to load memory files</p>
        </div>
      )}

      {!isLoading && !error && filtered?.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {search || activeType ? 'No matching memories' : 'No memory files yet'}
          </p>
          {!search && !activeType && (
            <button
              onClick={() => openMemoryEditor(projectId, null)}
              className="btn-primary mt-3 mx-auto"
            >
              <Plus size={13} />
              Create first memory
            </button>
          )}
        </div>
      )}

      {!isLoading && filtered && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f) => (
            <MemoryCard key={f.filename} file={f} projectId={projectId} />
          ))}
        </div>
      )}

      <MemoryEditor />
    </div>
  );
}
