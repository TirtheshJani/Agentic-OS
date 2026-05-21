"use client";

// Ported from .design-handoff/project/tweaks-panel.jsx.
// Floating bottom-right panel with density/starfield/card-signal toggles.
// Host postMessage protocol stripped; persistence via localStorage.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "agentic-os.tweaks";

export type Tweaks = {
  density: "compact" | "comfy" | "spacious";
  starfield: number;
  pulse: boolean;
  showLiveStrip: boolean;
  showDeptDot: boolean;
  showSkill: boolean;
  showCost: boolean;
};

export const TWEAK_DEFAULTS: Tweaks = {
  density: "comfy",
  starfield: 0.85,
  pulse: true,
  showLiveStrip: true,
  showDeptDot: true,
  showSkill: true,
  showCost: true,
};

type Ctx = {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
};

const TweaksContext = createContext<Ctx | null>(null);

export function useTweaks(): Ctx {
  const ctx = useContext(TweaksContext);
  if (!ctx) throw new Error("useTweaks must be used inside <TweaksProvider>");
  return ctx;
}

export function TweaksProvider({ children }: { children: ReactNode }) {
  const [tweaks, setTweaks] = useState<Tweaks>(TWEAK_DEFAULTS);

  // Read persisted values once on mount. We must SSR with defaults to avoid
  // hydration mismatch, then merge localStorage values after first paint.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Tweaks>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTweaks((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Ignore parse errors; defaults remain.
    }
  }, []);

  const setTweak = useCallback<Ctx["setTweak"]>((key, value) => {
    setTweaks((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors (private mode, quota).
      }
      return next;
    });
  }, []);

  // Apply density attribute and starfield CSS var to the document.
  useEffect(() => {
    document.body.setAttribute("data-density", tweaks.density);
    document.documentElement.style.setProperty(
      "--starfield-opacity",
      String(tweaks.starfield),
    );
  }, [tweaks.density, tweaks.starfield]);

  const ctx = useMemo(() => ({ tweaks, setTweak }), [tweaks, setTweak]);

  return <TweaksContext.Provider value={ctx}>{children}</TweaksContext.Provider>;
}

/* ------ The floating panel ------ */

export function TweaksFloatingPanel() {
  const { tweaks, setTweak } = useTweaks();
  const [open, setOpen] = useState(false);
  const dragRef = useRef<HTMLDivElement | null>(null);
  // Panel offset from the bottom-right of the viewport. State so React can
  // re-render the new position; drag handlers update via setOffset.
  const [offset, setOffset] = useState({ x: 16, y: 16 });
  const PAD = 16;

  const clampOffset = useCallback(
    (next: { x: number; y: number }) => {
      const panel = dragRef.current;
      if (!panel) return next;
      const w = panel.offsetWidth;
      const h = panel.offsetHeight;
      const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
      const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
      return {
        x: Math.min(maxRight, Math.max(PAD, next.x)),
        y: Math.min(maxBottom, Math.max(PAD, next.y)),
      };
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onResize = () => setOffset((prev) => clampOffset(prev));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, clampOffset]);

  const onDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev: MouseEvent) => {
      setOffset(
        clampOffset({
          x: startRight - (ev.clientX - sx),
          y: startBottom - (ev.clientY - sy),
        }),
      );
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="twk-fab"
        aria-label="Open tweaks"
        title="Tweaks"
        onClick={() => setOpen(true)}
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="2" />
          <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4" />
        </svg>
      </button>
    );
  }

  return (
    <div
      ref={dragRef}
      className="twk-panel"
      style={{ right: offset.x, bottom: offset.y }}
    >
      <div className="twk-hd" onMouseDown={onDragStart}>
        <b>Tweaks</b>
        <button
          className="twk-x"
          aria-label="Close tweaks"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
      </div>
      <div className="twk-body">
        <TweakSection label="Density & motion">
          <TweakRadio
            label="Density"
            value={tweaks.density}
            onChange={(v) => setTweak("density", v)}
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfy", label: "Comfy" },
              { value: "spacious", label: "Spacious" },
            ]}
          />
          <TweakSlider
            label="Starfield"
            value={tweaks.starfield}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setTweak("starfield", v)}
          />
          <TweakToggle
            label="Pulse rings on live agents"
            value={tweaks.pulse}
            onChange={(v) => setTweak("pulse", v)}
          />
        </TweakSection>
        <TweakSection label="Board signals">
          <TweakToggle
            label="Live runs strip"
            value={tweaks.showLiveStrip}
            onChange={(v) => setTweak("showLiveStrip", v)}
          />
          <TweakToggle
            label="Department dot"
            value={tweaks.showDeptDot}
            onChange={(v) => setTweak("showDeptDot", v)}
          />
          <TweakToggle
            label="Skill chip on card"
            value={tweaks.showSkill}
            onChange={(v) => setTweak("showSkill", v)}
          />
          <TweakToggle
            label="Cost on card"
            value={tweaks.showCost}
            onChange={(v) => setTweak("showCost", v)}
          />
        </TweakSection>
      </div>
    </div>
  );
}

/* ------ Layout helpers ------ */

function TweakSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

function TweakRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="twk-row">
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

/* ------ Controls ------ */

function TweakSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <TweakRow label={label} value={`${Math.round(value * 100) / 100}${unit}`}>
      <input
        type="range"
        className="twk-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </TweakRow>
  );
}

function TweakToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl">
        <span>{label}</span>
      </div>
      <button
        type="button"
        className="twk-toggle"
        data-on={value ? "1" : "0"}
        role="switch"
        aria-checked={!!value}
        onClick={() => onChange(!value)}
      >
        <i />
      </button>
    </div>
  );
}

type RadioOption<T extends string> = { value: T; label: string };

function TweakRadio<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: RadioOption<T>[];
  onChange: (v: T) => void;
}) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const n = options.length;
  return (
    <TweakRow label={label}>
      <div role="radiogroup" className="twk-seg">
        <div
          className="twk-seg-thumb"
          style={{
            left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
            width: `calc((100% - 4px) / ${n})`,
          }}
        />
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}
