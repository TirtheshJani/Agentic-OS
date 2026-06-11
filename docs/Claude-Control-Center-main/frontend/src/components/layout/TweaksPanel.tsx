import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export function TweaksPanel() {
  const [open, setOpen] = useState(false);
  const {
    theme, defaultMode, setDefaultMode,
    sidebarVariant, setSidebarVariant,
    density, setDensity,
  } = useTheme();

  return (
    <>
      {/* FAB */}
      <button
        className="aos-tweaks-fab"
        onClick={() => setOpen((o) => !o)}
        title="Tweaks"
        aria-label="Open tweaks panel"
      >
        {open ? <X size={16} /> : <SlidersHorizontal size={16} />}
      </button>

      {/* Panel */}
      {open && (
        <div className="aos-tweaks-panel">
          <div className="aos-tweaks-panel-header">Tweaks</div>
          <div className="aos-tweaks-body">
            <TweakGroup label="Default mode">
              {(['light', 'dark', 'system'] as const).map((m) => (
                <button
                  key={m}
                  className={`aos-tweak-opt ${defaultMode === m ? 'sel' : ''}`}
                  onClick={() => setDefaultMode(m)}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </TweakGroup>

            <TweakGroup label="Sidebar">
              {(['rail', 'default', 'wide'] as const).map((v) => (
                <button
                  key={v}
                  className={`aos-tweak-opt ${sidebarVariant === v ? 'sel' : ''}`}
                  onClick={() => setSidebarVariant(v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </TweakGroup>

            <TweakGroup label="Density">
              {(['spacious', 'balanced', 'dense'] as const).map((d) => (
                <button
                  key={d}
                  className={`aos-tweak-opt ${density === d ? 'sel' : ''}`}
                  onClick={() => setDensity(d)}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </TweakGroup>

            <div style={{ fontSize: '11px', color: 'var(--app-fg-dim)', paddingTop: 4 }}>
              Active theme: <strong style={{ color: 'var(--app-fg-muted)' }}>{theme}</strong>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TweakGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="aos-tweak-group">
      <div className="aos-tweak-label">{label}</div>
      <div className="aos-tweak-options">{children}</div>
    </div>
  );
}
