import Link from "next/link";

export function DegradedBanner({ reason }: { reason?: string }) {
  return (
    <div className="rounded-card border border-line bg-warn-bg px-3 py-2 text-sm text-warn">
      No embedding provider configured — keyword + link-graph retrieval only.
      {reason && <span> ({reason})</span>}{" "}
      <Link href="/settings" className="underline">
        Settings
      </Link>
    </div>
  );
}
