"use client";
import { useEffect, useState } from "react";
import { useSettings } from "@/hooks/useSettings";

/**
 * Alert banner after the kill switch fires (sessionStorage flag set by
 * TopHeader). Clears itself when autonomy is re-enabled or on dismiss.
 */
export function KillSwitchBanner() {
  const { settings } = useSettings();
  const [killed, setKilled] = useState(false);

  useEffect(() => {
    try {
      setKilled(sessionStorage.getItem("ao-killed") === "1");
    } catch {
      /* storage unavailable */
    }
  }, [settings]);

  if (!killed || settings?.autonomy.enabled) return null;

  function dismiss() {
    try { sessionStorage.removeItem("ao-killed"); } catch { /* storage unavailable */ }
    setKilled(false);
  }

  return (
    <div className="bg-danger-bg border-b border-danger px-5 py-2 flex items-center gap-3 text-sm text-danger">
      <span className="font-label uppercase tracking-wide text-[10px]">Kill switch armed</span>
      <span className="flex-1">Autonomy and the scheduler are off. Re-enable from the header toggle or Settings.</span>
      <button type="button" onClick={dismiss} className="hover:opacity-70">×</button>
    </div>
  );
}
