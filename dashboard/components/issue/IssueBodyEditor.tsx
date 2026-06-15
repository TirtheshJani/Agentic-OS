"use client";
import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/common/Field";

interface Props {
  title: string;
  body: string;
  onSave: (patch: { title?: string; body?: string }) => void;
}

export function IssueBodyEditor({ title, body, onSave }: Props) {
  const [localTitle, setLocalTitle] = useState(title);
  const [localBody, setLocalBody] = useState(body);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset local state when props change (e.g. switching issues).
  useEffect(() => {
    setLocalTitle(title);
    setLocalBody(body);
  }, [title, body]);

  function scheduleSave(patch: { title?: string; body?: string }) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(patch), 600);
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={localTitle}
        onChange={(e) => {
          setLocalTitle(e.target.value);
          scheduleSave({ title: e.target.value });
        }}
        className="w-full font-display text-lg font-semibold text-ink bg-transparent focus:outline-none border-b border-transparent hover:border-line2 focus:border-accent-line"
      />
      <Textarea
        rows={10}
        value={localBody}
        onChange={(e) => {
          setLocalBody(e.target.value);
          scheduleSave({ body: e.target.value });
        }}
        placeholder="Describe the work..."
      />
    </div>
  );
}
