"use client";
import { useState } from "react";
import { Drawer } from "@/components/common/Drawer";
import { Button } from "@/components/common/Button";
import { filterEligible } from "@/lib/eligibleAgents";

interface Agent {
  slug: string;
  name: string;
  skills: string[];
}

interface Props {
  projectSlug: string;
  projectCapabilities: string[];
  currentCrew: string[];
  allAgents: Agent[];
  onClose: () => void;
}

export function CrewPickerDrawer({ projectSlug, projectCapabilities, currentCrew, allAgents, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentCrew));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible = filterEligible(allAgents, projectCapabilities);

  function toggle(slug: string) {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setSelected(next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/crew`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crew: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      title="Edit crew"
      width="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save crew"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-500 mb-4">
        Showing agents whose skills overlap with this project's capabilities ({projectCapabilities.join(", ") || "none set"}).
      </p>
      {eligible.length === 0 ? (
        <p className="text-sm text-gray-400">No eligible agents. Add capabilities to PROJECT.md or skills to agents.</p>
      ) : (
        <ul className="space-y-2">
          {eligible.map(a => {
            const checked = selected.has(a.slug);
            return (
              <li key={a.slug}>
                <label className={"flex items-start gap-3 p-3 rounded-md border " + (checked ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30" : "border-gray-200 dark:border-gray-800")}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(a.slug)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{a.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{a.slug}</div>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {a.skills.map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900">{s}</span>
                      ))}
                    </div>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </Drawer>
  );
}
