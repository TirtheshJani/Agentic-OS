"use client";
import clsx from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300",
  secondary: "border border-gray-300 dark:border-gray-700 hover:border-gray-500 bg-white dark:bg-gray-950",
  ghost: "hover:bg-gray-100 dark:hover:bg-gray-900",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
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
