"use client";

// Ported from .design-handoff/project/shared.jsx.
// Visual atoms shared across screens: Avatar, PriorityBars/Chip, DeptDot/Tag,
// SkillChip, StatusDot, Sparkline, CostMeter, SectionHead, Tip.

import { useEffect, useState, type ReactNode } from "react";
import {
  agentByHandle,
  COLUMNS,
  deptOf,
  PRIORITIES,
  type IssueStatus,
  type Priority,
} from "@/lib/design/data";

/* ------ Avatar ------ */
export function Avatar({
  handle,
  size = 22,
  ring = false,
  running = false,
  title,
}: {
  handle: string | null;
  size?: number;
  ring?: boolean;
  running?: boolean;
  title?: string;
}) {
  const a = agentByHandle(handle);
  if (!a) {
    return (
      <span
        className="avatar avatar-empty"
        style={{ width: size, height: size }}
        title={title || "Unassigned"}
      >
        ·
      </span>
    );
  }
  const isAgent = a.kind === "agent";
  const borderColor = running ? "var(--status-running)" : ring ? a.color : "transparent";
  return (
    <span
      className={"avatar " + (running ? "pulse-ring" : "")}
      style={{
        width: size,
        height: size,
        borderRadius: isAgent ? "5px" : "50%",
        background: `linear-gradient(135deg, ${a.color}40, ${a.color}10)`,
        color: a.color,
        border: `1.5px solid ${borderColor}`,
        fontSize: Math.max(8.5, size * 0.42),
      }}
      title={title || `@${a.handle} · ${a.name}`}
    >
      {a.initials}
    </span>
  );
}

/* ------ Priority bars (Linear-style) ------ */
export function PriorityBars({
  priority,
  size = 14,
}: {
  priority: Priority | null;
  size?: number;
}) {
  const def = priority ? PRIORITIES[priority] : null;
  const filled = def ? def.bars : 0;
  const color = def ? def.color : "var(--text-dim)";
  return (
    <span
      className="prio-bars"
      style={{ width: size, height: size }}
      title={def ? def.label : "No priority"}
    >
      {[1, 2, 3, 4].map((b) => {
        const isFilled = b <= filled;
        const heightPct = 25 + (b - 1) * 22;
        return (
          <span
            key={b}
            className="prio-bar"
            style={{
              height: heightPct + "%",
              background: isFilled ? color : "rgba(255,255,255,0.08)",
            }}
          />
        );
      })}
    </span>
  );
}

export function PriorityChip({ priority }: { priority: Priority | null }) {
  if (!priority) {
    return (
      <span className="prio-chip prio-none">
        <span className="prio-bar-icon">
          <span />
          <span />
          <span />
          <span />
        </span>
        No priority
      </span>
    );
  }
  const def = PRIORITIES[priority];
  return (
    <span className={"prio-chip prio-" + priority}>
      <PriorityBars priority={priority} size={11} />
      {def.label}
    </span>
  );
}

/* ------ Department tag ------ */
export function DeptDot({ dept, size = 8 }: { dept: string | null; size?: number }) {
  const d = deptOf(dept);
  if (!d) return null;
  return (
    <span
      className="dept-dot"
      style={{
        width: size,
        height: size,
        background: d.color,
        boxShadow: `0 0 6px ${d.color}80`,
      }}
      title={"Department · " + d.label}
    />
  );
}

export function DeptTag({ dept }: { dept: string | null }) {
  const d = deptOf(dept);
  if (!d) return null;
  return (
    <span
      className="dept-tag"
      style={{
        color: d.color,
        borderColor: `${d.color}40`,
        background: `${d.color}12`,
      }}
    >
      <span className="dept-tag-glyph" style={{ background: d.color }} />
      {d.label}
    </span>
  );
}

/* ------ Skill chip ------ */
export function SkillChip({ name }: { name: string | null }) {
  if (!name) return null;
  return (
    <span className="skill-chip" title={"Will run skill · " + name}>
      <span className="skill-chip-bracket">⟨</span>
      {name}
      <span className="skill-chip-bracket">⟩</span>
    </span>
  );
}

/* ------ Status dot for column header ------ */
export function StatusDot({
  status,
  size = 11,
}: {
  status: IssueStatus | string;
  size?: number;
}) {
  const col = COLUMNS.find((c) => c.key === status) || {
    color: "var(--text-dim)",
    glyph: "○",
  };
  return (
    <span
      className={"status-dot status-dot-" + status}
      style={{
        width: size,
        height: size,
        color: col.color,
        fontSize: Math.max(9, size - 1),
      }}
    >
      {col.glyph}
    </span>
  );
}

/* ------ Sparkline (mini) ------ */
export function Sparkline({
  values,
  width = 56,
  height = 14,
  color = "var(--ember)",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values, 1);
  return (
    <span className="spark" style={{ height, width }}>
      {values.map((v, i) => (
        <span
          key={i}
          style={{
            height: Math.max(2, (v / max) * height) + "px",
            background: color,
            opacity: 0.4 + (v / max) * 0.6,
          }}
        />
      ))}
    </span>
  );
}

/* ------ Cost / token meter ------ */
export function CostMeter({
  cost,
  compact = false,
}: {
  cost: number | null | undefined;
  compact?: boolean;
}) {
  if (cost === 0 || cost === null || cost === undefined) {
    return <span className="cost cost-zero">$0.00</span>;
  }
  return (
    <span className={"cost " + (compact ? "cost-compact" : "")}>
      <span className="cost-currency">$</span>
      {cost.toFixed(2)}
    </span>
  );
}

/* ------ Section header (eyebrow + meta) ------ */
export function SectionHead({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <span className="t-eyebrow">{title}</span>
      <span className="section-head-line" />
      {meta && <span className="section-head-meta">{meta}</span>}
      {action}
    </div>
  );
}

/* ------ Live tick (re-renders every intervalMs) ------ */
export function useTick(intervalMs = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
}

/* ------ Tooltip popover (hover) ------ */
export function Tip({
  children,
  content,
  side = "top",
}: {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="tip-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && <span className={"tip tip-" + side}>{content}</span>}
    </span>
  );
}
