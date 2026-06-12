import { Card } from "@/components/common/Card";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

/** Dashboard stats-row cell: uppercase label, big Oswald number, sub-text. */
export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <Card className="px-4 py-3">
      <p className="font-label uppercase tracking-wide text-[10px] text-ink3">{label}</p>
      <p className="font-label text-2xl text-ink mt-1">{value}</p>
      {sub && <p className="text-xs text-ink3 mt-0.5">{sub}</p>}
    </Card>
  );
}
