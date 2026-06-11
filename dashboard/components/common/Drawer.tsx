"use client";
import { useEffect } from "react";
import clsx from "clsx";

interface DrawerProps {
  title: string;
  width?: "sm" | "md" | "lg";
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const widthMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export function Drawer({ title, width = "md", onClose, children, footer }: DrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={clsx(
        "relative ml-auto bg-surface border-l border-line h-full flex flex-col w-full shadow-card-lg",
        widthMap[width]
      )}>
        <header className="px-5 py-3 border-b border-line flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="text-ink3 hover:text-ink">×</button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="px-5 py-3 border-t border-line flex justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
