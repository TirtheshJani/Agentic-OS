"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useSettings } from "@/hooks/useSettings";
import { useRuntimes } from "@/hooks/useRuntimes";
import { StatusDot } from "@/components/common/StatusDot";
import type { FeatureKey } from "@/lib/settings";

interface NavItem {
  href: string;
  label: string;
  /** When set, the item hides if the feature flag is off. */
  feature?: FeatureKey;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/new", label: "New Project" },
      { href: "/issues", label: "Issues" },
      { href: "/inbox", label: "Inbox", feature: "inbox" },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { href: "/notes", label: "Notes", feature: "notes" },
      { href: "/ask", label: "Ask Vault", feature: "ask" },
      { href: "/graph", label: "Graph", feature: "graph" },
      { href: "/research", label: "Research", feature: "research" },
      { href: "/learning", label: "Learning", feature: "learning" },
      { href: "/studio", label: "Studio", feature: "studio" },
    ],
  },
  {
    label: "Telemetry",
    items: [
      { href: "/activity", label: "Activity" },
      { href: "/sessions", label: "Sessions", feature: "sessions" },
      { href: "/analytics", label: "Analytics", feature: "analytics" },
      { href: "/evals", label: "Evals", feature: "evals" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/agents", label: "Agents" },
      { href: "/skills", label: "Skills" },
      { href: "/docker", label: "Docker", feature: "docker" },
      { href: "/runtimes", label: "Runtimes" },
      { href: "/connections", label: "Connections", feature: "connections" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

/** Subscription each runtime bills against (see CLAUDE.md "Dashboard architecture"). */
const PLAN_LABELS: Record<string, string> = {
  "claude-code": "Max",
  "gemini-cli": "Pro",
};

export function NavSidebar() {
  const pathname = usePathname();
  const { settings } = useSettings();
  const runtimes = useRuntimes();

  return (
    <nav className="w-[228px] shrink-0 border-r border-line bg-surface flex flex-col sticky top-0 h-screen overflow-y-auto">
      <Link href="/" className="px-4 pt-4 pb-2 block">
        <span className="font-label uppercase tracking-[0.18em] text-sm text-ink block">Agentic OS</span>
        <span className="font-label uppercase tracking-[0.22em] text-[9px] text-ink3 block">Command Center</span>
      </Link>

      <div className="flex-1 px-2 py-2">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(
            (item) => !item.feature || !settings || settings.features[item.feature]
          );
          if (items.length === 0) return null;
          return (
            <div key={group.label ?? "main"} className="mb-2">
              {group.label && (
                <p className="px-2 pt-2 pb-1 font-label uppercase tracking-wide text-[9px] text-ink3">{group.label}</p>
              )}
              {items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "block rounded-md px-2 py-1.5 text-sm transition-colors duration-150",
                      active ? "bg-accent-bg text-accent-ink font-medium" : "text-ink2 hover:bg-surface2"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="border-t border-line px-4 py-3">
        <p className="font-label uppercase tracking-wide text-[9px] text-ink3 mb-2">Runtimes</p>
        {(runtimes ?? []).map((rt) => (
          <div key={rt.id} className="flex items-center gap-2 py-0.5 text-xs">
            <StatusDot tone={rt.availability.available ? "ok" : "neutral"} />
            <span className="text-ink2 flex-1 truncate">{rt.displayName}</span>
            <span className="font-label uppercase text-[9px] text-ink3">
              {PLAN_LABELS[rt.id] ?? (rt.availability.version ?? "")}
            </span>
          </div>
        ))}
      </div>
    </nav>
  );
}
