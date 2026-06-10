"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";

export function AutonomyPill() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive) setEnabled(Boolean(data.autonomy?.enabled));
      } catch {
        // server restarting; keep last value
      }
    }
    check();
    const t = setInterval(check, 30_000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (enabled === null) return null;
  return (
    <Link
      href="/settings"
      title="Autonomy kill switch lives in Settings"
      className={clsx(
        "text-[10px] font-semibold px-2 py-1 rounded-full text-center",
        enabled
          ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200"
          : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
      )}
    >
      AUTONOMY {enabled ? "ON" : "OFF"}
    </Link>
  );
}
