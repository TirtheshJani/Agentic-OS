"use client";

// Ported from .design-handoff/project/app.jsx.
// Root shell: sidebar nav + top bar + view router + global slide-over.

import { useMemo, useState } from "react";
import { Avatar, useTick } from "@/components/design/atoms";
import { I } from "@/components/design/icons";
import { BoardScreen } from "@/components/design/board-screen";
import { DashboardScreen } from "@/components/design/dashboard-screen";
import { IssueDetail } from "@/components/design/issue-detail";
import {
  AgentsScreen,
  InboxScreen,
  MyIssuesScreen,
  SettingsScreen,
  SkillsScreen,
} from "@/components/design/other-screens";
import {
  TweaksFloatingPanel,
  TweaksProvider,
  useTweaks,
} from "@/components/design/tweaks-panel";
import { AGENTS, ISSUES, PROJECTS, SKILLS } from "@/lib/design/data";

export type ViewKey =
  | "dashboard"
  | "issues"
  | "inbox"
  | "myissues"
  | "agents"
  | "skills"
  | "runtimes"
  | "settings";

const VIEW_LABELS: Record<ViewKey, string> = {
  dashboard: "Dashboard",
  issues: "Issues",
  inbox: "Inbox",
  myissues: "My Issues",
  agents: "Agents",
  skills: "Skills",
  runtimes: "Runtimes",
  settings: "Settings",
};

function AppContents() {
  const [view, setView] = useState<ViewKey>("dashboard");
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const { tweaks } = useTweaks();

  // Tick to make "live" indicators feel alive (running cost counters).
  useTick(2000);

  const navigate = (next: ViewKey) => setView(next);
  const openIssue = (id: string) => setOpenIssueId(id);
  const closeIssue = () => setOpenIssueId(null);

  return (
    <div className="app-shell">
      <Sidebar view={view} onNav={navigate} />
      <main className="screen" style={{ background: "transparent" }}>
        <TopBar view={view} />
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {view === "dashboard" && (
            <DashboardScreen
              onOpenIssue={openIssue}
              onNavigate={navigate}
            />
          )}
          {view === "issues" && (
            <BoardScreen onOpenIssue={openIssue} tweaks={tweaks} />
          )}
          {view === "inbox" && <InboxScreen onOpenIssue={openIssue} />}
          {view === "agents" && <AgentsScreen />}
          {(view === "skills" || view === "runtimes") && <SkillsScreen />}
          {view === "settings" && <SettingsScreen />}
          {view === "myissues" && (
            <MyIssuesScreen onOpenIssue={openIssue} />
          )}
        </div>
      </main>
      {openIssueId && (
        <IssueDetail issueId={openIssueId} onClose={closeIssue} />
      )}
    </div>
  );
}

export function AppShell() {
  return (
    <TweaksProvider>
      <AppContents />
      <TweaksFloatingPanel />
    </TweaksProvider>
  );
}

/* ---------- Sidebar ---------- */
function Sidebar({
  view,
  onNav,
}: {
  view: ViewKey;
  onNav: (v: ViewKey) => void;
}) {
  const counts = useMemo(() => {
    return {
      inbox: ISSUES.filter((i) => i.status === "review").length,
      myissues: ISSUES.filter((i) => i.reporter === "tj").length,
      issues: ISSUES.length,
      agents: AGENTS.filter((a) => a.kind === "agent").length,
      skills: SKILLS.length,
    };
  }, []);

  const running = ISSUES.filter((i) => i.status === "running");
  const burn = running.reduce((s, i) => s + (i.cost || 0), 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">A</div>
        <div className="col">
          <span className="brand-name">Agentic OS</span>
          <span className="brand-sub">MMXXVI · TJ</span>
        </div>
      </div>

      <div className="workspace-pill">
        <span
          className="workspace-mark"
          style={{
            background:
              "linear-gradient(135deg, var(--ember), var(--ember-deep))",
            color: "#061018",
          }}
        >
          AOS
        </span>
        <div className="col grow">
          <span className="workspace-meta">Agentic OS</span>
          <span
            className="dim"
            style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
          >
            v0.4.2 · local
          </span>
        </div>
        <I.chevron size={12} style={{ color: "var(--text-dim)" }} />
      </div>

      <div className="sidebar-section">
        <NavItem
          Icon={I.board}
          label="Dashboard"
          active={view === "dashboard"}
          onClick={() => onNav("dashboard")}
        />
        <NavItem
          Icon={I.inbox}
          label="Inbox"
          active={view === "inbox"}
          onClick={() => onNav("inbox")}
          count={counts.inbox}
        />
        <NavItem
          Icon={I.mine}
          label="My Issues"
          active={view === "myissues"}
          onClick={() => onNav("myissues")}
          count={counts.myissues}
        />
        <NavItem
          Icon={I.issues}
          label="Issues"
          active={view === "issues"}
          onClick={() => onNav("issues")}
          count={counts.issues}
        />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-eyebrow">Architecture</div>
        <NavItem
          Icon={I.agents}
          label="Agents"
          active={view === "agents"}
          onClick={() => onNav("agents")}
          count={counts.agents}
        />
        <NavItem
          Icon={I.runtimes}
          label="Runtimes"
          active={view === "runtimes"}
          onClick={() => onNav("runtimes")}
        />
        <NavItem
          Icon={I.skills}
          label="Skills"
          active={view === "skills"}
          onClick={() => onNav("skills")}
          count={counts.skills}
        />
        <NavItem
          Icon={I.vault}
          label="Vault"
          active={false}
          onClick={() => {}}
        />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-eyebrow">Active Projects</div>
        {PROJECTS.filter((p) => p.active).map((p) => (
          <button
            key={p.slug}
            className="nav-item"
            onClick={() => onNav("issues")}
          >
            <span
              className="dept-dot"
              style={{
                width: 7,
                height: 7,
                background: p.color,
                boxShadow: `0 0 6px ${p.color}80`,
              }}
            />
            <span className="grow truncate">{p.name}</span>
            <span className="nav-count">
              {p.slug === "agentic-os" ? counts.issues : p.open}
            </span>
          </button>
        ))}
      </div>

      <div className="sidebar-foot">
        {running.length > 0 && (
          <div className="live-rail">
            <div className="live-rail-head">
              <span
                className="dot pulse-ring"
                style={{ background: "var(--status-running)" }}
              />
              {running.length} live · ${burn.toFixed(2)}
            </div>
            {running.slice(0, 3).map((i) => (
              <div key={i.id} className="live-rail-row">
                <Avatar handle={i.assignee} size={14} />
                <span
                  className="dim font-mono"
                  style={{ fontSize: 9.5 }}
                >
                  {i.id}
                </span>
                <span
                  className="truncate"
                  style={{ fontSize: 10.5, color: "var(--text-muted)" }}
                >
                  {i.live?.tool}
                </span>
              </div>
            ))}
          </div>
        )}
        <NavItem
          Icon={I.settings}
          label="Settings"
          active={view === "settings"}
          onClick={() => onNav("settings")}
        />
      </div>
    </aside>
  );
}

function NavItem({
  Icon,
  label,
  active,
  count,
  onClick,
}: {
  Icon: (props: { size?: number }) => React.ReactElement;
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      className={"nav-item " + (active ? "active" : "")}
      onClick={onClick}
    >
      <span className="nav-icon">
        <Icon size={15} />
      </span>
      <span className="grow">{label}</span>
      {count !== undefined && <span className="nav-count">{count}</span>}
    </button>
  );
}

/* ---------- Top bar ---------- */
function TopBar({ view }: { view: ViewKey }) {
  return (
    <header className="topbar">
      <div className="crumb">
        <I.bolt size={12} style={{ color: "var(--ember)" }} />
        <span>Agentic OS</span>
        <span className="crumb-sep">/</span>
        <span className="crumb-current">{VIEW_LABELS[view]}</span>
      </div>
      <span className="grow" />
      <div className="topbar-right">
        <button className="btn btn-ghost">
          <I.search size={13} /> <span className="dim">Search · </span>
          <span className="kbd">⌘</span>
          <span className="kbd">K</span>
        </button>
        <button className="btn btn-ghost" title="GitHub">
          <I.github size={13} />
        </button>
        <Avatar handle="tj" size={24} />
      </div>
    </header>
  );
}
