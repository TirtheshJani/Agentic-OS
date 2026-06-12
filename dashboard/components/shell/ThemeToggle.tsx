"use client";
import { useEffect, useState } from "react";

function currentTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Flips data-theme, persists to localStorage, and mirrors to settings. */
export function ThemeToggle() {
  // null until mounted: the server can't know the active theme.
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => setTheme(currentTheme()), []);

  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage unavailable */
    }
    setTheme(next);
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => undefined);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="Toggle theme"
      aria-label="Toggle theme"
      className="w-8 h-8 rounded-md border border-line text-ink2 hover:bg-surface2 transition-colors"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
