"use client";
import clsx from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary: "border border-line2 hover:border-accent-line bg-surface text-ink",
  ghost: "text-ink2 hover:bg-surface2",
  danger: "bg-danger text-white hover:opacity-90",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", className, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      {...rest}
      className={clsx(
        "text-sm px-3 py-1.5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
        styles[variant],
        className
      )}
    />
  );
});
