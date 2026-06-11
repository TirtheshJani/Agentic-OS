import clsx from "clsx";

interface CardProps {
  /** "raise" lifts the card off surface backgrounds (mockup's --raise). */
  variant?: "surface" | "raise";
  shadow?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Card({ variant = "surface", shadow = false, className, children }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-card border border-line",
        variant === "surface" ? "bg-surface" : "bg-raise",
        shadow && "shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}
