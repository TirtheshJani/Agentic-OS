"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { AutonomyPill } from "@/components/shell/AutonomyPill";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/new", label: "New Project" },
  { href: "/issues", label: "Issues" },
  { href: "/inbox", label: "Inbox" },
  { href: "/agents", label: "Agents" },
  { href: "/skills", label: "Skills" },
  { href: "/graph", label: "Graph" },
  { href: "/runtimes", label: "Runtimes" },
  { href: "/connections", label: "Connections" },
  { href: "/settings", label: "Settings" },
];

export function NavSidebar() {
  const pathname = usePathname();
  return (
    <nav className="w-48 shrink-0 border-r border-gray-200 dark:border-gray-800 p-3 flex flex-col gap-1 sticky top-0 h-screen overflow-y-auto">
      <Link href="/" className="px-2 py-2 font-semibold text-sm">
        Agentic OS
      </Link>
      <div className="px-2 mb-2">
        <AutonomyPill />
      </div>
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "rounded-md px-2 py-1.5 text-sm",
              active
                ? "bg-gray-200 dark:bg-gray-800 font-medium text-gray-900 dark:text-gray-100"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
