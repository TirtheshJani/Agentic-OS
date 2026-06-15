"use client";
import clsx from "clsx";
import { SelectHTMLAttributes, forwardRef } from "react";

type Size = "sm" | "md";

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: Size;
  /** Stretch the control (and its wrapper) to the container width. */
  fullWidth?: boolean;
}

const sizes: Record<Size, string> = {
  sm: "text-xs pl-2.5 pr-7 py-1",
  md: "text-sm pl-3 pr-8 py-1.5",
};

// One styled select for the whole app (replaces three divergent inline
// stylings in IssueHeader, RunsTab, and IssueCard). Native <select> for
// accessibility + zero-JS open behavior; we only restyle the chrome and draw a
// custom chevron so it matches the cosmic-v2 surfaces. Token-driven, so it
// tracks light/dark automatically.
export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { size = "md", fullWidth, className, children, ...rest },
  ref
) {
  return (
    <span className={clsx("relative inline-flex", fullWidth && "flex w-full")}>
      <select
        ref={ref}
        {...rest}
        className={clsx(
          "appearance-none rounded-card border border-line2 bg-surface text-ink",
          "transition-colors hover:border-accent-line focus:outline-none focus:ring-2 focus:ring-accent-line",
          "disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
          sizes[size],
          fullWidth && "w-full",
          className
        )}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className={clsx(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink3",
          size === "sm" ? "right-2 w-2.5 h-2.5" : "right-2.5 w-3 h-3"
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" />
      </svg>
    </span>
  );
});
