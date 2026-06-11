import { useLocation } from 'react-router-dom';
import { Activity, Bell, Sun, Moon, Terminal } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useUIStore } from '../../store/uiStore';

const CRUMBS: Record<string, string[]> = {
  '/dashboard':        ['Workspace', 'Command Center'],
  '/conversations':    ['Workspace', 'Sessions'],
  '/plans':            ['Workspace', 'Plans & Tasks'],
  '/tasks':            ['Workspace', 'Plans & Tasks'],
  '/mcp-servers':      ['Workspace', 'Governance'],
  '/hooks':            ['Workspace', 'Governance'],
  '/rules':            ['Workspace', 'Governance'],
  '/agents':           ['Agents', 'Claude Code'],
  '/codex-sessions':   ['Agents', 'Codex'],
  '/codex':            ['Agents', 'Codex Rescue'],
  '/codex-skills':     ['Agents', 'Codex Skills'],
  '/codex-settings':   ['Agents', 'Codex Settings'],
  '/codex-memory':     ['Agents', 'Codex Memory'],
  '/codex-analytics':  ['Agents', 'Codex Analytics'],
  '/agent-library':    ['Agents', 'Agent Library'],
  '/workspace':        ['Agents', 'GWS Workspace'],
  '/memory':           ['Memory', 'Project Memory'],
  '/claude-md':        ['Memory', 'CLAUDE.md / AGENTS.md'],
  '/analytics':        ['Insights', 'Analytics'],
  '/insights':         ['Insights', 'Insights'],
  '/changelog':        ['Insights', 'Updates'],
  '/history':          ['Insights', 'History'],
  '/advisor':          ['Insights', 'Advisor'],
  '/routines':         ['Insights', 'Routines'],
  '/health':           ['Insights', 'Health'],
  '/settings':         ['Workspace', 'Settings'],
};

function getCrumbs(pathname: string): string[] {
  // Exact match first
  if (CRUMBS[pathname]) return CRUMBS[pathname];
  // Prefix match
  const match = Object.keys(CRUMBS)
    .filter(k => pathname.startsWith(k) && k !== '/')
    .sort((a, b) => b.length - a.length)[0];
  if (match) return CRUMBS[match];
  // Fallback: capitalize last segment
  const seg = pathname.split('/').filter(Boolean).pop() ?? 'Home';
  return ['Workspace', seg.charAt(0).toUpperCase() + seg.slice(1)];
}

export function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const crumbs = getCrumbs(pathname);
  const openCommandPalette = useUIStore((s) => s.setCommandPaletteOpen);

  return (
    <header className="aos-topbar">
      {/* Breadcrumbs */}
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? 'here' : ''}>{c}</span>
          </span>
        ))}
      </div>

      {/* Search pill */}
      <div
        className="search-pill"
        role="button"
        tabIndex={0}
        aria-label="Search or run command"
        onClick={() => openCommandPalette(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openCommandPalette(true);
          }
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span className="search-label">Jump to session, plan, file, or run command…</span>
        <span className="kbd">⌘K</span>
      </div>

      {/* Actions */}
      <div className="aos-topbar-actions">
        <button className="aos-icon-btn" title="Live activity" aria-label="Live activity">
          <Activity size={15} />
          <span className="badge-dot" />
        </button>
        <button className="aos-icon-btn" title="Notifications" aria-label="Notifications">
          <Bell size={15} />
        </button>

        {/* Theme toggle */}
        <button
          className="aos-toggle-track"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          aria-label="Toggle theme"
        >
          <Sun size={12} />
          <Moon size={12} />
          <span className="thumb">
            {theme === 'light' ? <Sun size={12} /> : <Moon size={12} />}
          </span>
        </button>

        <div style={{ width: 1, height: 22, background: 'var(--aos-border)', margin: '0 4px' }} />

        <button className="aos-btn primary sm" style={{ gap: 6 }}>
          <Terminal size={13} />
          <span>Open CLI</span>
        </button>
      </div>
    </header>
  );
}
