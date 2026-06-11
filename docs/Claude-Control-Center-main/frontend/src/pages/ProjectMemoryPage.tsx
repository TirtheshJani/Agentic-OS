import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Brain } from 'lucide-react';
import { MemoryList } from '../components/memory/MemoryList';
import { useProjects } from '../hooks/useProjects';

export function ProjectMemoryPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const project = projects?.find((p) => p.id === projectId);

  return (
    <div className="p-6">
      <button
        onClick={() => navigate('/memory')}
        className="flex items-center gap-2 text-sm mb-5 hover:opacity-80 transition-opacity"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={14} />
        All Memory
      </button>

      <div className="flex items-center gap-3 mb-6">
        <Brain size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {project?.displayName ?? projectId} Memory
        </h1>
      </div>

      {projectId && <MemoryList projectId={decodeURIComponent(projectId)} />}
    </div>
  );
}
