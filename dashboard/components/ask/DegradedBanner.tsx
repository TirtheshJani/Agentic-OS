import Link from "next/link";

export function DegradedBanner({ reason }: { reason?: string }) {
  return (
    <div className="rounded-md border border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
      No embedding provider configured — keyword + link-graph retrieval only.
      {reason && <span> ({reason})</span>}{" "}
      <Link href="/settings" className="underline">
        Settings
      </Link>
    </div>
  );
}
