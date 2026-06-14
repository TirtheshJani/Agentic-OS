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
      className="h-8 w-8 rounded-full border border-line2 text-ink2 transition-colors hover:border-accent-line hover:bg-surface2"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
