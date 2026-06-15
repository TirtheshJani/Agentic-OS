"use client";
import clsx from "clsx";
import { useState, type ReactNode } from "react";

const TABS = ["Board", "Knowledge"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  board: ReactNode;
  knowledge: ReactNode;
}

export function ProjectTabs({ board, knowledge }: Props) {
  const [active, setActive] = useState<Tab>("Board");

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-line mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={active === tab}
            onClick={() => setActive(tab)}
            className={clsx(
              "px-3 py-2 -mb-px border-b-2 font-label uppercase tracking-wide text-xs transition-colors",
              active === tab
                ? "border-accent text-accent-ink"
                : "border-transparent text-ink3 hover:text-ink"
            )}
          >
            {tab}
          </button>
        ))}
      </div>
      {/* Both panes stay mounted so switching tabs never refetches or flickers. */}
      <div hidden={active !== "Board"}>{board}</div>
      <div hidden={active !== "Knowledge"}>{knowledge}</div>
    </div>
  );
}
