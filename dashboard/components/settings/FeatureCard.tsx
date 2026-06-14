"use client";
import { Card } from "@/components/common/Card";
import { Switch } from "@/components/common/Switch";
import { StatusDot } from "@/components/common/StatusDot";
import { Pill } from "@/components/common/Pill";

interface FeatureCardProps {
  name: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function FeatureCard({ name, description, enabled, onToggle }: FeatureCardProps) {
  return (
    <Card className="p-4 flex items-start gap-3 transition-colors hover:border-accent-line">
      <div className="min-w-0 flex-1">
        <p className="font-label uppercase tracking-wide text-[11px] text-ink">{name}</p>
        <p className="text-xs text-ink2 mt-1">{description}</p>
        <Pill tone={enabled ? "ok" : "neutral"} className="mt-2">
          <StatusDot tone={enabled ? "ok" : "neutral"} />
          {enabled ? "Enabled" : "Disabled"}
        </Pill>
      </div>
      <Switch checked={enabled} onChange={onToggle} label={`Toggle ${name}`} />
    </Card>
  );
}
