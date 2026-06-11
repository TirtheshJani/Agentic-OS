import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { TweaksPanel } from './TweaksPanel';
import { ThemeProvider } from './ThemeProvider';
import { CommandPalette } from './CommandPalette';
import { useUIStore } from '../../store/uiStore';

export function AppShell() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useUIStore.setState((s) => ({ commandPaletteOpen: !s.commandPaletteOpen }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ThemeProvider>
      <div className="app-shell">
        <Sidebar />
        <div className="main-col">
          <Topbar />
          <div className="main-scroll">
            <Outlet />
          </div>
        </div>
      </div>
      <TweaksPanel />
      <CommandPalette />
    </ThemeProvider>
  );
}
