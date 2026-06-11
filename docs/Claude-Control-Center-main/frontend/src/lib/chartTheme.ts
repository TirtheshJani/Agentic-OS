// ---------------------------------------------------------------------------
// Shared Chart.js theme
// ---------------------------------------------------------------------------
// Chart.js renders to <canvas>, which does NOT understand CSS custom properties
// or oklch(). Every colour fed to a chart dataset/option must be a plain hex or
// rgba string. These constants mirror the design tokens in src/index.css so the
// charts stay visually consistent with the rest of the UI.
//
// Shared by the Claude analytics charts (AnalyticsPage) and available to the
// Gemini / Codex CLI analytics views.

export const ACCENT = '#0ecbbe'; // vivid teal matching --accent oklch(71% 0.185 192)
export const GREEN = '#3ec85e'; // success green matching --success oklch(70% 0.17 145)
export const ORANGE = '#f97316';
export const AMBER = '#f59e0b';

export const TICK_COLOR = '#8b949e';
export const GRID_COLOR = 'rgba(255,255,255,0.05)';
export const TOOLTIP_BG = 'rgba(13,17,23,0.95)';
export const TITLE_COLOR = '#e6edf3';

// Quality tiers (Analytics → Quality tab)
export const QUALITY_HIGH_COLOR = '#3ec85e';
export const QUALITY_MED_COLOR = '#f59e0b';
export const QUALITY_LOW_COLOR = '#ef4444';

export const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: TICK_COLOR, font: { size: 11 } } },
    tooltip: {
      backgroundColor: TOOLTIP_BG,
      titleColor: TITLE_COLOR,
      bodyColor: TICK_COLOR,
    },
  },
  scales: {
    x: {
      ticks: { color: TICK_COLOR, font: { size: 10 } },
      grid: { color: GRID_COLOR },
    },
    y: {
      ticks: { color: TICK_COLOR, font: { size: 10 } },
      grid: { color: GRID_COLOR },
    },
  },
} as const;
