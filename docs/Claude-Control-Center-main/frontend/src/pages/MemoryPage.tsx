import { useState } from 'react';
import { Brain, Plus } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { MemoryList } from '../components/memory/MemoryList';
import { MemoryEditor } from '../components/memory/MemoryEditor';
import { RagSearchPanel } from '../components/memory/RagSearchPanel';
import { RagAddDialog } from '../components/memory/RagAddDialog';
import { IngestPanel } from '../components/memory/IngestPanel';

export function MemoryPage() {
  const { data: projects } = useProjects();
  const allProjects = projects ?? [];
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [ragDialogOpen, setRagDialogOpen] = useState(false);

  const displayProject = selectedProject ?? allProjects[0]?.id;

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Brain size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Memory
        </h1>
      </div>

      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Knowledge Base</span>
          <button
            onClick={() => setRagDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:bg-white/10"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            <Plus size={12} /> Add to RAG
          </button>
        </div>
        <IngestPanel />
        <RagSearchPanel />
        <RagAddDialog open={ragDialogOpen} onClose={() => setRagDialogOpen(false)} />
      </div>

      {/* Project selector */}
      {allProjects.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Project:</span>
          {allProjects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id)}
              className="chip transition-all"
              style={{
                background: displayProject === p.id ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
                color: displayProject === p.id ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              {p.displayName}
              {p.hasMemory && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-[#a855f7] inline-block" />}
            </button>
          ))}
        </div>
      )}

      {displayProject && <MemoryList projectId={displayProject} />}
      {!displayProject && (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No projects found</p>
        </div>
      )}
    </div>
  );
}
