import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import { SessionList } from '../components/conversation/SessionList';
import { useProjects } from '../hooks/useProjects';

export function SessionListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: projects } = useProjects();

  const project = projects?.find((p) => p.id === projectId);

  return (
    <div className="p-6">
      <button
        onClick={() => navigate('/conversations')}
        className="flex items-center gap-2 text-sm mb-5 hover:opacity-80 transition-opacity"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={14} />
        All Projects
      </button>

      <div className="flex items-center gap-3 mb-6">
        <FolderOpen size={18} style={{ color: 'var(--accent)' }} />
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {project?.displayName ?? projectId}
          </h1>
          {project?.fullPath && (
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {project.fullPath}
            </p>
          )}
        </div>
      </div>

      {projectId && <SessionList projectId={decodeURIComponent(projectId)} />}
    </div>
  );
}
