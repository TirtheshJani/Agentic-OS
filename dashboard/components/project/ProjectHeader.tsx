"use client";
import Link from "next/link";
import { Button } from "@/components/common/Button";
import { SectionHeader } from "@/components/common/SectionHeader";

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
      <nav className="text-xs text-ink3 mb-4 font-label uppercase tracking-wide">
        <Link href="/" className="hover:text-accent-ink">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-ink2">{name}</span>
      </nav>
      <SectionHeader
        kicker="Project"
        size="lg"
        title={name}
        action={<Button variant="primary" onClick={onNewIssue}>+ New Issue</Button>}
      />
      <div className="-mt-2 flex flex-wrap items-center gap-3 text-xs">
        <span className="truncate font-mono text-ink3" title={path}>{path}</span>
        {repo && (
          <a href={repo} target="_blank" rel="noreferrer" className="truncate text-accent-ink hover:underline">
            {repo}
          </a>
        )}
        <span className="rounded-pill bg-surface2 px-2 py-0.5 font-mono text-ink2">
          {runtimeDefault}
        </span>
      </div>
    </header>
  );
}
