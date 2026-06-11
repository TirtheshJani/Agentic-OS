import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#e5fdfb",
          100: "#c0f9f4",
          200: "#82f2ea",
          300: "#3de4d8",
          400: "#0ecfc0",
          500: "#0cbdb0",  // vivid teal — matches --accent oklch(71% 0.185 192)
          600: "#0a9d92",
          700: "#0a7e75",
          800: "#0b645d",
          900: "#0d5350",
          950: "#053530",
        },
        accent: "oklch(71% 0.185 192)",
        success: "oklch(70% 0.17 145)",
        error: "oklch(62% 0.22 25)",
        warning: "oklch(72% 0.17 70)",
      },
      fontFamily: {
        sans: ["Chivo", "system-ui", "sans-serif"],
        display: ['"Big Shoulders Display"', "system-ui", "sans-serif"],
        mono: ['"Chivo Mono"', '"Fira Code"', "monospace"],
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "3px",
        md: "3px",
        lg: "3px",
        xl: "4px",
        "2xl": "5px",
        full: "9999px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "cursor-blink": "cursor-blink 1.2s step-end infinite",
      },
      keyframes: {
        "cursor-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
