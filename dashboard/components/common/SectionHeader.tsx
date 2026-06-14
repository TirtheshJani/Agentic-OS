import clsx from "clsx";

interface SectionHeaderProps {
  title: string;
  description?: string;
  /** Uppercase Oswald accent line above the title (mockup motif). */
  kicker?: string;
  /** "lg" renders the larger Playfair hero title used on the command center. */
  size?: "default" | "lg";
  /** Right-aligned action slot (buttons, filters). */
  action?: React.ReactNode;
}

export function SectionHeader({ title, description, kicker, size = "default", action }: SectionHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-3 mb-4">
      <div>
        {kicker && (
          <p className="font-label uppercase tracking-[0.22em] text-[10px] text-accent-ink mb-1.5">{kicker}</p>
        )}
        <h1 className={clsx("font-display font-semibold text-ink", size === "lg" ? "text-3xl" : "text-2xl")}>
          {title}
        </h1>
        {description && <p className="text-sm text-ink2 mt-1">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </header>
  );
}
