"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { NAV_GROUPS } from "@/components/shell/NavSidebar";
import { useSettings } from "@/hooks/useSettings";

interface Action {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

/** Flip data-theme (mirrors ThemeToggle) without importing it. */
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {
    /* storage unavailable */
  }
  fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme: next }),
  }).catch(() => undefined);
}

/**
 * Global command palette opened with ⌘K / Ctrl+K (or the header search button,
 * via the `ao:open-command-palette` event). Fuzzy-filters navigation targets and
 * quick actions; arrow keys + Enter to run, Esc to close. Built without extra deps.
 */
export function CommandPalette() {
  const router = useRouter();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const actions = useMemo<Action[]>(() => {
    const nav = NAV_GROUPS.flatMap((group) =>
      group.items
        .filter((item) => !item.feature || !settings || settings.features[item.feature])
        .map((item) => ({
          id: `nav:${item.href}`,
          label: item.label,
          hint: group.label ?? "Go",
          run: () => router.push(item.href),
        }))
    );
    const quick: Action[] = [
      { id: "act:new", label: "New Project", hint: "Action", run: () => router.push("/new") },
      { id: "act:theme", label: "Toggle theme", hint: "Action", run: toggleTheme },
    ];
    return [...nav, ...quick];
  }, [router, settings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) => a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q)
    );
  }, [actions, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("ao:open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("ao:open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // focus after paint so the input exists
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  function close() {
    setOpen(false);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[active];
      if (item) {
        item.run();
        close();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative mt-[12vh] w-full max-w-xl overflow-hidden rounded-card border border-line bg-surface shadow-card-lg">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink3" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            role="combobox"
            aria-expanded="true"
            aria-controls="ao-command-list"
            placeholder="Search or jump to…"
            className="flex-1 bg-transparent py-3 text-sm text-ink outline-none placeholder:text-ink3"
          />
          <kbd className="font-mono text-[10px] rounded border border-line2 bg-surface2 px-1.5 py-0.5 text-ink3">ESC</kbd>
        </div>
        <ul id="ao-command-list" ref={listRef} role="listbox" className="ao-scroll max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-ink3">No matches</li>
          )}
          {filtered.map((a, i) => (
            <li
              key={a.id}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                a.run();
                close();
              }}
              className={clsx(
                "flex cursor-pointer items-center justify-between gap-3 px-4 py-2",
                i === active ? "bg-accent-bg text-accent-ink" : "text-ink2 hover:bg-surface2"
              )}
            >
              <span className="text-sm">{a.label}</span>
              <span className="font-label uppercase tracking-wide text-[9px] text-ink3">{a.hint}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
