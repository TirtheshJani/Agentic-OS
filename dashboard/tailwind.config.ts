import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      // Token-backed palette (see app/globals.css). Named to avoid clobbering
      // Tailwind utility namespaces: ink = text tiers, line = border tiers,
      // canvas = page background. Var-backed colors don't support /opacity
      // modifiers; use the explicit *-bg rgba tokens for translucent fills.
      colors: {
        canvas: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        raise: "var(--raise)",
        line: "var(--border)",
        line2: "var(--border-2)",
        ink: "var(--text)",
        ink2: "var(--text-2)",
        ink3: "var(--text-3)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        "accent-bg": "var(--accent-bg)",
        "accent-line": "var(--accent-line)",
        ok: "var(--ok)",
        "ok-bg": "var(--ok-bg)",
        danger: "var(--danger)",
        "danger-bg": "var(--danger-bg)",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        label: ["var(--font-label)", "ui-sans-serif", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        card: "var(--shadow)",
        "card-lg": "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
} satisfies Config;
