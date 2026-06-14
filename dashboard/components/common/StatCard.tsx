import clsx from "clsx";
import { Card } from "@/components/common/Card";

type DeltaTone = "ok" | "danger" | "warn" | "accent" | "neutral";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  /** Small colored change indicator shown next to the value (e.g. "+12%"). */
  delta?: string;
  deltaTone?: DeltaTone;
}

const deltaToneClass: Record<DeltaTone, string> = {
  ok: "text-ok",
  danger: "text-danger",
  warn: "text-warn",
  accent: "text-accent-ink",
  neutral: "text-ink3",
};

/** Dashboard stats-row cell: uppercase label, big Oswald number, optional delta + sub-text. */
export function StatCard({ label, value, sub, delta, deltaTone = "neutral" }: StatCardProps) {
  return (
    <Card className="px-4 py-3">
      <p className="font-label uppercase tracking-wide text-[10px] text-ink3">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-label text-3xl leading-none text-ink">{value}</span>
        {delta && <span className={clsx("text-xs font-medium", deltaToneClass[deltaTone])}>{delta}</span>}
      </div>
      {sub && <p className="text-xs text-ink3 mt-1">{sub}</p>}
    </Card>
  );
}
