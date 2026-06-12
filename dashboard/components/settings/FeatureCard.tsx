"use client";
import { Card } from "@/components/common/Card";
import { Switch } from "@/components/common/Switch";
import { StatusDot } from "@/components/common/StatusDot";

interface FeatureCardProps {
  name: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function FeatureCard({ name, description, enabled, onToggle }: FeatureCardProps) {
  return (
    <Card className="p-4 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{name}</p>
        <p className="text-xs text-ink3 mt-0.5">{description}</p>
        <p className="flex items-center gap-1.5 text-[10px] font-label uppercase tracking-wide text-ink3 mt-2">
          <StatusDot tone={enabled ? "ok" : "neutral"} />
          {enabled ? "Enabled" : "Disabled"}
        </p>
      </div>
      <Switch checked={enabled} onChange={onToggle} label={`Toggle ${name}`} />
    </Card>
  );
}
