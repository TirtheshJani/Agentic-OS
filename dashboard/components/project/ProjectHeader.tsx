"use client";
import Link from "next/link";
import { Button } from "@/components/common/Button";

interface Props {
  name: string;
  slug: string;
  path: string;
  repo: string | null;
  runtimeDefault: string;
  onNewIssue: () => void;
}

export function ProjectHeader({ name, path, repo, runtimeDefault, onNewIssue }: Props) {
  return (
    <header className="mb-6">
      <nav className="text-sm text-ink3 mb-4">
        <Link href="/" className="hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <span>{name}</span>
      </nav>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{name}</h1>
          <p className="text-sm text-ink3 mt-1 truncate" title={path}>{path}</p>
          <div className="flex items-center gap-3 mt-2 text-xs">
            {repo && (
              <a href={repo} target="_blank" rel="noreferrer" className="text-accent hover:underline truncate">
                {repo}
              </a>
            )}
            <span className="px-1.5 py-0.5 rounded bg-surface2 text-ink2 font-mono">
              {runtimeDefault}
            </span>
          </div>
        </div>
        <Button variant="primary" onClick={onNewIssue}>+ New Issue</Button>
      </div>
    </header>
  );
}
