"use client";
import clsx from "clsx";
import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink2">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && !error && <p className="text-xs text-ink3 mt-1">{hint}</p>}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </label>
  );
}

const inputBase =
  "w-full rounded-md border border-line2 bg-surface text-ink px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-line";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputBase, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(inputBase, "font-mono leading-relaxed", props.className)} />;
}
