"use client";
import { useEffect, useState } from "react";
import { Drawer } from "@/components/common/Drawer";
import { Button } from "@/components/common/Button";
import { Field, Input, Textarea } from "@/components/common/Field";
import { useRuntimes } from "@/hooks/useRuntimes";

interface SkillOption {
  name: string;
  domain: string;
}

interface Props {
  /** null = create mode; a slug = edit that agent. */
  editSlug: string | null;
  onClose: () => void;
}

interface FormState {
  name: string;
  slug: string;
  description: string;
  runtime: string;
  skills: string[];
  allowedTools: string;
  systemPrompt: string;
}

const EMPTY: FormState = {
  name: "",
  slug: "",
  description: "",
  runtime: "claude-code",
  skills: [],
  allowedTools: "Read, Write, Glob, Grep",
  systemPrompt: "",
};

export function AgentEditor({ editSlug, onClose }: Props) {
  const runtimes = useRuntimes();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [skillOptions, setSkillOptions] = useState<SkillOption[]>([]);
  const [loading, setLoading] = useState(editSlug != null);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/skills", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setSkillOptions(data.skills.map((s: { name: string; domain: string }) => ({ name: s.name, domain: s.domain }))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!editSlug) return;
    fetch(`/api/agents/${editSlug}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((a) => {
        if (!a) return;
        setForm({
          name: a.name,
          slug: a.slug,
          description: a.description ?? "",
          runtime: a.runtime,
          skills: a.skills,
          allowedTools: a.allowedTools.join(", "),
          systemPrompt: a.systemPrompt,
        });
      })
      .finally(() => setLoading(false));
  }, [editSlug]);

  function toggleSkill(name: string) {
    setForm((f) => ({
      ...f,
      skills: f.skills.includes(name) ? f.skills.filter((s) => s !== name) : [...f.skills, name],
    }));
  }

  async function draftWithAi() {
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: draftPrompt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const d = data.draft;
      setForm((f) => ({
        ...f,
        name: d.name,
        slug: editSlug ?? d.slug,
        description: d.description,
        skills: d.skills,
        allowedTools: d.allowedTools.join(", "),
        systemPrompt: d.systemPrompt,
      }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description || undefined,
      runtime: form.runtime,
      skills: form.skills,
      allowedTools: form.allowedTools.split(",").map((t) => t.trim()).filter(Boolean),
      systemPrompt: form.systemPrompt,
    };
    try {
      const res = await fetch(editSlug ? `/api/agents/${editSlug}` : "/api/agents", {
        method: editSlug ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.errors?.join("; ") || data.error || `HTTP ${res.status}`);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!editSlug) return;
    if (!confirm(`Archive agent "${editSlug}"? The file moves to agents/_archive/.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/agents/${editSlug}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Drawer title={editSlug ? `Edit agent: ${editSlug}` : "New agent"} width="lg" onClose={onClose}
      footer={
        <>
          {editSlug && (
            <Button variant="ghost" onClick={archive} disabled={busy}>Archive</Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy || loading || !form.name || !form.slug || !form.systemPrompt}>
            {busy ? "Saving..." : editSlug ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-gray-400">Loading agent...</p>
      ) : (
        <div className="space-y-4">
          <section className="rounded-md border border-dashed border-gray-300 dark:border-gray-700 p-3 space-y-2">
            <p className="text-xs text-gray-500">
              Describe the agent and let Claude draft the profile (one headless call against your Max plan credits).
            </p>
            <div className="flex gap-2">
              <Input
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                placeholder="e.g. watch FDA digital health guidance and summarize weekly"
              />
              <Button variant="ghost" onClick={draftWithAi} disabled={drafting || draftPrompt.trim().length < 10}>
                {drafting ? "Drafting..." : "Draft with AI"}
              </Button>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Slug" hint={editSlug ? "Slug cannot change after creation." : "kebab-case, becomes agents/<slug>.md"}>
              <Input
                value={form.slug}
                disabled={editSlug != null}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Description" hint="Used by lead routing; pack it with domain keywords.">
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>

          <Field label="Runtime">
            <select
              value={form.runtime}
              onChange={(e) => setForm({ ...form, runtime: e.target.value })}
              className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm w-full"
            >
              {(runtimes ?? []).map((rt) => (
                <option key={rt.id} value={rt.id} disabled={!rt.availability.available}>
                  {rt.displayName}{rt.availability.available ? "" : " (not installed)"}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`Skills (${form.skills.length} selected)`}>
            <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-800 p-2 grid grid-cols-2 gap-1">
              {skillOptions.map((s) => (
                <label key={s.name} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.skills.includes(s.name)}
                    onChange={() => toggleSkill(s.name)}
                  />
                  <span className="truncate" title={`${s.domain}/${s.name}`}>{s.name}</span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Allowed tools" hint="Comma-separated, e.g. Read, Write, Bash, WebFetch.">
            <Input value={form.allowedTools} onChange={(e) => setForm({ ...form, allowedTools: e.target.value })} />
          </Field>

          <Field label="System prompt">
            <Textarea rows={10} value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Drawer>
  );
}
