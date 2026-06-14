import Link from "next/link";

interface ProjectCardProps {
  slug: string;
  name: string;
  path: string;
  repo: string | null;
  crew: string[];
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

export function ProjectCard({ slug, name, path, repo, crew, capabilities, lastModified }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${slug}`}
      className="block rounded-card border border-line bg-surface p-4 transition-colors hover:border-accent-line"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-accent-bg font-label font-semibold text-accent-ink">
          {initials(slug)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold text-ink">{name}</h3>
            <span className="shrink-0 text-xs text-ink3">{formatRelative(lastModified)}</span>
          </div>
          {repo ? (
            <p className="mt-0.5 truncate font-mono text-[11px] text-ink3" title={repo}>
              {repoLabel(repo)}
            </p>
          ) : (
            <p className="mt-0.5 truncate text-[11px] text-ink3" title={path}>
              {path}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        {crew.length > 0 ? (
          <div className="flex items-center">
            {crew.slice(0, 4).map((m, i) => (
              <span
                key={m}
                title={m}
                style={{ background: avatarColor(m), marginLeft: i ? -6 : 0 }}
                className="grid h-6 w-6 place-items-center rounded-full border-2 border-surface font-label text-[9px] text-white"
              >
                {initials(m)}
              </span>
            ))}
            {crew.length > 4 && <span className="ml-1.5 text-[10px] text-ink3">+{crew.length - 4}</span>}
          </div>
        ) : (
          <span className="text-[11px] text-ink3">No crew yet</span>
        )}
        {capabilities.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1">
            {capabilities.slice(0, 3).map((c) => (
              <span
                key={c}
                className="rounded-pill bg-surface2 px-2 py-0.5 font-label text-[9px] uppercase tracking-wide text-ink2"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
