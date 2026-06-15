"use client";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useSettings } from "@/hooks/useSettings";
import { Switch } from "@/components/common/Switch";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { NAV_GROUPS } from "@/components/shell/NavSidebar";

function breadcrumb(pathname: string): { group: string; label: string } {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) {
        return { group: group.label ?? "Agentic OS", label: item.label };
      }
    }
  }
  return { group: "Agentic OS", label: "" };
}

function openPalette() {
  window.dispatchEvent(new CustomEvent("ao:open-command-palette"));
}

export function TopHeader() {
  const pathname = usePathname();
  const { settings, patch } = useSettings();
  const { group, label } = breadcrumb(pathname);

  const autonomyOn = Boolean(settings?.autonomy.enabled);

  function setAutonomy(enabled: boolean) {
    if (!settings) return;
    patch({ autonomy: { ...settings.autonomy, enabled } });
    if (enabled) {
      try { sessionStorage.removeItem("ao-killed"); } catch { /* storage unavailable */ }
    }
  }

  function killSwitch() {
    if (!settings) return;
    if (!confirm("Kill switch: disable autonomy and the scheduler immediately?")) return;
    patch({ autonomy: { ...settings.autonomy, enabled: false, schedulerEnabled: false } });
    try { sessionStorage.setItem("ao-killed", "1"); } catch { /* storage unavailable */ }
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface px-5 py-2.5">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="font-label text-[10px] uppercase tracking-[0.18em] text-ink3">{group}</span>
        {label && <span className="text-xs text-ink3">/</span>}
        <span className="truncate font-display text-[17px] font-semibold text-ink">{label}</span>
      </div>

      <button
        type="button"
        onClick={openPalette}
        className="ml-auto hidden min-w-[230px] items-center gap-2.5 rounded-pill border border-line2 bg-surface px-3 py-1.5 text-xs text-ink3 transition-colors hover:border-accent-line sm:flex"
        aria-label="Open command palette"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="font-mono text-[10px] rounded border border-line2 bg-surface2 px-1.5 py-0.5">⌘K</kbd>
      </button>

      {settings && (
        <div
          className={clsx(
            "flex items-center gap-2 rounded-pill border px-3 py-1 transition-colors",
            autonomyOn ? "border-accent-line bg-accent-bg" : "border-line2 bg-surface"
          )}
        >
          <span
            className={clsx(
              "font-label text-[10px] uppercase tracking-wide",
              autonomyOn ? "text-accent-ink" : "text-ink3"
            )}
          >
            Autonomy
          </span>
          <Switch checked={autonomyOn} onChange={setAutonomy} label="Autonomy" />
        </div>
      )}

      <ThemeToggle />

      <button
        type="button"
        onClick={killSwitch}
        className="font-label text-[10px] uppercase tracking-wide rounded-pill border border-danger px-3 py-1.5 text-danger transition-colors hover:bg-danger-bg"
      >
        Kill Switch
      </button>

      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-label text-[11px] text-[#cfe3f7] ring-1 ring-line2"
        style={{ background: "linear-gradient(160deg,#2a5d8f,#0a1426)" }}
        aria-hidden="true"
      >
        TJ
      </span>
    </header>
  );
}
