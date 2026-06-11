import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FolderOpen, MessageSquare, Brain, Clock, Trash2 } from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';
import { purgeProject } from '../../api/projects';
import { relativeTime, truncate } from '../../lib/utils';
import { queryKeys } from '../../lib/queryKeys';

function ProjectSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <div className="skeleton h-5 w-2/3" />
      <div className="skeleton h-3 w-full" />
      <div className="flex gap-2">
        <div className="skeleton h-5 w-16" />
        <div className="skeleton h-5 w-20" />
      </div>
    </div>
  );
}

export function ProjectList() {
  const { data: projects, isLoading, error } = useProjects();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handlePurge(e: React.MouseEvent, projectId: string, displayName: string) {
    e.stopPropagation();
    if (!window.confirm(`Permanently delete all sessions and memory for "${displayName}"? This cannot be undone.`)) return;
    setDeletingId(projectId);
    try {
      await purgeProject(projectId);
      await qc.invalidateQueries({ queryKey: queryKeys.projects() });
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <ProjectSkeleton key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-center">
          <p className="text-sm" style={{ color: 'var(--error)' }}>Failed to load projects</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Make sure the backend is running on port 5050</p>
        </div>
      </div>
    );
  }

  if (!projects?.length) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No projects found in ~/.claude/projects/</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
      {projects.map((project) => (
        <button
          key={project.id}
          onClick={() => navigate(`/conversations/${encodeURIComponent(project.id)}`)}
          className="card p-4 text-left w-full group"
          style={{ cursor: 'pointer' }}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <FolderOpen size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                {project.displayName}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {project.hasMemory && (
                <Brain size={13} style={{ color: '#a855f7' }} aria-label="Has memory" />
              )}
              <button
                onClick={(e) => handlePurge(e, project.id, project.displayName)}
                disabled={deletingId === project.id}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--danger, #ef4444)' }}
                title="Purge project"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <p className="text-xs font-mono mb-3 truncate" style={{ color: 'var(--text-tertiary)' }}>
            {truncate(project.fullPath, 50)}
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="chip" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              <MessageSquare size={10} />
              {project.sessionCount} session{project.sessionCount !== 1 ? 's' : ''}
            </span>
            {project.lastActivity && (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <Clock size={10} />
                {relativeTime(project.lastActivity)}
              </span>
            )}
            {project.qualityTier && project.avgQualityScore != null && (
              <span
                className="chip"
                style={{
                  background:
                    project.qualityTier === 'high' ? 'rgba(62,200,94,0.15)' :
                    project.qualityTier === 'medium' ? 'rgba(245,158,11,0.15)' :
                    'rgba(239,68,68,0.15)',
                  color:
                    project.qualityTier === 'high' ? '#3ec85e' :
                    project.qualityTier === 'medium' ? '#f59e0b' :
                    '#ef4444',
                }}
              >
                ★ {project.avgQualityScore}/100
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
