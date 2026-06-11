import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';
type DefaultMode = 'light' | 'dark' | 'system';
type SidebarVariant = 'rail' | 'default' | 'wide';
type Density = 'spacious' | 'balanced' | 'dense';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  defaultMode: DefaultMode;
  setDefaultMode: (m: DefaultMode) => void;
  sidebarVariant: SidebarVariant;
  setSidebarVariant: (v: SidebarVariant) => void;
  density: Density;
  setDensity: (d: Density) => void;
  tweaksPanelOpen: boolean;
  setTweaksPanelOpen: (open: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function resolveTheme(mode: DefaultMode): Theme {
  if (mode === 'system') return getSystemTheme();
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [defaultMode, setDefaultModeState] = useState<DefaultMode>(() => {
    try {
      const stored = localStorage.getItem('aos:defaultMode');
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {}
    return 'system';
  });

  const [theme, setTheme] = useState<Theme>(() => resolveTheme(defaultMode));
  const [sidebarVariant, setSidebarVariantState] = useState<SidebarVariant>(() => {
    try {
      const s = localStorage.getItem('aos:sidebar');
      if (s === 'rail' || s === 'default' || s === 'wide') return s;
    } catch {}
    return 'default';
  });
  const [density, setDensityState] = useState<Density>(() => {
    try {
      const d = localStorage.getItem('aos:density');
      if (d === 'spacious' || d === 'balanced' || d === 'dense') return d;
    } catch {}
    return 'balanced';
  });
  const [tweaksPanelOpen, setTweaksPanelOpen] = useState(false);

  // Watch system changes when mode is "system"
  useEffect(() => {
    if (defaultMode !== 'system') return;
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [defaultMode]);

  // Apply theme to html element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Apply density
  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  // Apply sidebar variant (for CSS targeting)
  useEffect(() => {
    document.documentElement.setAttribute('data-sidebar', sidebarVariant);
    const w = sidebarVariant === 'rail' ? 64 : sidebarVariant === 'wide' ? 280 : 248;
    document.documentElement.style.setProperty('--sidebar-width', `${w}px`);
  }, [sidebarVariant]);

  const toggleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    setDefaultModeState(next);
    try { localStorage.setItem('aos:defaultMode', next); } catch {}
  };

  const setDefaultMode = (m: DefaultMode) => {
    setDefaultModeState(m);
    try { localStorage.setItem('aos:defaultMode', m); } catch {}
    if (m === 'system') {
      setTheme(getSystemTheme());
    } else {
      setTheme(m);
    }
  };

  const setSidebarVariant = (v: SidebarVariant) => {
    setSidebarVariantState(v);
    try { localStorage.setItem('aos:sidebar', v); } catch {}
  };

  const setDensity = (d: Density) => {
    setDensityState(d);
    try { localStorage.setItem('aos:density', d); } catch {}
  };

  return (
    <ThemeContext.Provider value={{
      theme, toggleTheme,
      defaultMode, setDefaultMode,
      sidebarVariant, setSidebarVariant,
      density, setDensity,
      tweaksPanelOpen, setTweaksPanelOpen,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
