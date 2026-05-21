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
        "ml-auto bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 h-full flex flex-col w-full",
        widthMap[width]
      )}>
        <header className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
