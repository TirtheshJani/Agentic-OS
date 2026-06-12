"use client";
import clsx from "clsx";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name; required because the control renders no text. */
  label: string;
}

/** 40x22 toggle switch (mockup motif). */
export function Switch({ checked, onChange, disabled = false, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative w-10 h-[22px] rounded-full transition-colors duration-200 shrink-0",
        checked ? "bg-accent" : "bg-surface2 border border-line2",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={clsx(
          "absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all duration-200",
          checked ? "left-[21px]" : "left-[3px]"
        )}
      />
    </button>
  );
}
