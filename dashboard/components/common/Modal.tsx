"use client";
import { useEffect } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-950 rounded-lg shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-800">
        <header className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold">{title}</h2>
        </header>
        <div className="px-5 py-4 space-y-3">{children}</div>
        {footer && (
          <footer className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
