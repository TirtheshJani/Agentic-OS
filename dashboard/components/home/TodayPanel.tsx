"use client";
import Link from "next/link";
import { Card } from "@/components/common/Card";
import { Switch } from "@/components/common/Switch";
import { useSettings } from "@/hooks/useSettings";

export function TodayPanel({ activeRunCount }: { activeRunCount: number }) {
  const { settings, patch } = useSettings();

  return (
    <Card className="p-4 space-y-4">
      <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3">Today</h2>

      {settings && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink2">Autonomy</span>
          <Switch
            checked={settings.autonomy.enabled}
            onChange={(enabled) => patch({ autonomy: { ...settings.autonomy, enabled } })}
            label="Autonomy"
          />
        </div>
      )}

      {settings && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink2">Concurrency</span>
          <span className="font-label text-ink">
            {activeRunCount}
            <span className="text-ink3"> / {settings.concurrency.globalMax}</span>
          </span>
        </div>
      )}

      <Link
        href="/agents"
        className="block text-center bg-accent text-white rounded-md py-2 text-sm hover:opacity-90 transition-opacity"
      >
        New agent
      </Link>
    </Card>
  );
}
