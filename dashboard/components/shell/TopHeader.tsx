"use client";
import { usePathname } from "next/navigation";
import { useSettings } from "@/hooks/useSettings";
import { Switch } from "@/components/common/Switch";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { NAV_GROUPS } from "@/components/shell/NavSidebar";

function sectionLabel(pathname: string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) return item.label;
    }
  }
  return "";
}

export function TopHeader() {
  const pathname = usePathname();
  const { settings, patch } = useSettings();

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
    <header className="sticky top-0 z-30 bg-surface border-b border-line px-5 py-2.5 flex items-center gap-4">
      <p className="text-sm text-ink2 flex-1 min-w-0 truncate">
        <span className="text-ink3">Agentic OS</span>
        {sectionLabel(pathname) && <span className="text-ink3"> / </span>}
        <span className="text-ink font-medium">{sectionLabel(pathname)}</span>
      </p>

      {settings && (
        <label className="flex items-center gap-2 font-label uppercase tracking-wide text-[10px] text-ink2">
          Autonomy
          <Switch checked={autonomyOn} onChange={setAutonomy} label="Autonomy" />
        </label>
      )}

      <ThemeToggle />

      <button
        type="button"
        onClick={killSwitch}
        className="font-label uppercase tracking-wide text-[10px] px-3 py-1.5 rounded-md border border-danger text-danger hover:bg-danger-bg transition-colors"
      >
        Kill Switch
      </button>
    </header>
  );
}
