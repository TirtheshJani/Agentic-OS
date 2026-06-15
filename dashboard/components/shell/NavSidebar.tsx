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
    label: "Command",
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/new", label: "New Project" },
      { href: "/issues", label: "Issues" },
      { href: "/inbox", label: "Inbox", feature: "inbox" },
    ],
  },
  {
    label: "Memory",
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
    label: "Work",
    items: [
      { href: "/activity", label: "Activity" },
      { href: "/sessions", label: "Sessions", feature: "sessions" },
      { href: "/events", label: "Events" },
    ],
  },
  {
    label: "Insight",
    items: [
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
    <nav className="sticky top-0 flex h-screen w-[228px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface">
      <Link href="/" className="flex items-center gap-2.5 px-4 pb-2 pt-4">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] shadow-glow"
          style={{ background: "linear-gradient(160deg,#1b3a5c,#0a1426)" }}
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4.6" fill="#cfe3f7" />
            <ellipse
              cx="12"
              cy="12"
              rx="10"
              ry="3.4"
              stroke="#6faef3"
              strokeWidth="1.4"
              transform="rotate(-20 12 12)"
            />
          </svg>
        </span>
        <span className="leading-none">
          <span className="block font-label text-sm uppercase tracking-[0.18em] text-ink">Agentic OS</span>
          <span className="mt-1 block font-label text-[9px] uppercase tracking-[0.22em] text-ink3">Command Center</span>
        </span>
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
                <p className="px-2 pb-1 pt-2 font-label text-[9px] uppercase tracking-[0.22em] text-ink3">
                  {group.label}
                </p>
              )}
              {items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "block rounded-md px-2 py-1.5 text-sm transition-colors duration-150",
                      active ? "bg-accent-bg font-medium text-accent-ink" : "text-ink2 hover:bg-surface2"
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
        <p className="mb-2 font-label text-[9px] uppercase tracking-wide text-ink3">Runtimes</p>
        {(runtimes ?? []).map((rt) => (
          <div key={rt.id} className="flex items-center gap-2 py-0.5 text-xs">
            <StatusDot tone={rt.availability.available ? "ok" : "neutral"} />
            <span className="flex-1 truncate text-ink2">{rt.displayName}</span>
            <span className="font-label text-[9px] uppercase text-ink3">
              {PLAN_LABELS[rt.id] ?? rt.availability.version ?? ""}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-line px-4 py-2.5">
        <p className="font-label text-[8px] uppercase tracking-[0.18em] text-ink3">© 2026 Tirtheshjani.com</p>
      </div>
    </nav>
  );
}
