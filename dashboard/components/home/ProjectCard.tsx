import Link from "next/link";

interface ProjectCardProps {
  slug: string;
  name: string;
  path: string;
  repo: string | null;
  crewSize: number;
  capabilities: string[];
  lastModified: number;
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function repoLabel(repo: string): string {
  try {
    return new URL(repo).pathname.replace(/^\//, "");
  } catch {
    return repo;
  }
}

export function ProjectCard({ slug, name, path, repo, crewSize, capabilities, lastModified }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${slug}`}
      className="block rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold truncate">{name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title={path}>{path}</p>
        </div>
        <span className="text-xs text-gray-400 ml-2 shrink-0">{formatRelative(lastModified)}</span>
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs">
        <span className="text-gray-500">
          Crew: <span className="font-medium text-gray-700 dark:text-gray-300">{crewSize}</span>
        </span>
        {repo && (
          <span className="text-gray-500 truncate" title={repo}>
            {repoLabel(repo)}
          </span>
        )}
      </div>
      {capabilities.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-3">
          {capabilities.slice(0, 5).map(c => (
            <span key={c} className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
              {c}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
