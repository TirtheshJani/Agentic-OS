import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, FileText, ShieldCheck,
  Bot, Library, Activity,
  Brain, BookOpen, Puzzle,
  BarChart2, Lightbulb, Newspaper,
  History, Sparkles, Repeat, RefreshCcw, CalendarClock, HeartPulse, Settings, Radio, LucideIcon,
  LayoutGrid, BookMarked, FlaskConical, GitBranch, Container, Film, Target, ClipboardCheck,
  ReceiptText, Megaphone, ChevronDown, Zap, Database, Users, Briefcase,
} from 'lucide-react';
import { useSSE } from '../../hooks/useSSE';
import { useActiveSessions } from '../../hooks/useSettings';
import { useQuery } from '@tanstack/react-query';
import { fetchHealthReferences } from '../../api/health';
import { relativeTime, shortPath } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { queryKeys } from '../../lib/queryKeys';
import { routePaths } from '../../routes';
import { useTheme } from './ThemeProvider';

interface NavSubItem {
  to: string;
  icon: LucideIcon;
  label: string;
  agentColor?: string;
  navKey?: string;
}

interface NavDirectLink {
  type: 'link';
  to: string;
  icon: LucideIcon;
  label: string;
  color: string;
  navKey?: string;
}

interface NavGroup {
  type: 'group';
  id: string;
  icon: LucideIcon;
  label: string;
  color: string;
  navKey?: string;
  items: NavSubItem[];
}

type NavEntry = NavDirectLink | NavGroup;

const NAV_ENTRIES: NavEntry[] = [
  {
    type: 'link',
    to: routePaths.dashboard,
    icon: LayoutDashboard,
    label: 'Dashboard',
    color: 'var(--orange-500)',
  },
  {
    type: 'group',
    id: 'sessions',
    icon: MessageSquare,
    label: 'Sessions',
    color: 'var(--orange-500)',
    navKey: 'sessions',
    items: [
      { to: routePaths.conversations,       icon: Bot,          label: 'Claude Code',  agentColor: 'claude'  },
      { to: routePaths.codexSessions,        icon: Bot,          label: 'Codex',        agentColor: 'codex'   },
      { to: routePaths.geminiSessions,       icon: Bot,          label: 'Gemini',       agentColor: 'gemini'  },
      { to: routePaths.antigravitySessions,  icon: Bot,          label: 'Antigravity',  agentColor: 'gemini'  },
      { to: routePaths.routines,             icon: Repeat,       label: 'Routines'      },
      { to: routePaths.loops,                icon: RefreshCcw,   label: 'Loops'         },
      { to: routePaths.scheduler,            icon: CalendarClock, label: 'Scheduler'    },
    ],
  },
  {
    type: 'link',
    to: routePaths.plans,
    icon: FileText,
    label: 'Plans & Tasks',
    color: 'var(--orange-500)',
    navKey: 'plans',
  },
  {
    type: 'group',
    id: 'agents',
    icon: Bot,
    label: 'Agents',
    color: 'var(--steel-500)',
    items: [
      { to: routePaths.agents,       icon: Bot,      label: 'Managed Agents', agentColor: 'claude'   },
      { to: routePaths.agentLibrary, icon: Library,  label: 'Agent Library'  },
      { to: routePaths.agentView,    icon: Activity, label: 'Agent View'     },
      { to: routePaths.workspace,    icon: LayoutGrid, label: 'GWS Workspace', agentColor: 'gemini' },
      { to: routePaths.codex,        icon: Bot,      label: 'Codex Rescue',  agentColor: 'opencode' },
    ],
  },
  {
    type: 'group',
    id: 'knowledge',
    icon: Brain,
    label: 'Knowledge',
    color: 'var(--green-500)',
    items: [
      { to: routePaths.memory,    icon: Brain,      label: 'Project Memory'        },
      { to: routePaths.claudeMd,  icon: BookOpen,   label: 'CLAUDE.md / AGENTS.md' },
      { to: routePaths.codexSkills, icon: Puzzle,   label: 'Skills'               },
      { to: routePaths.obsidian,  icon: BookMarked, label: 'Obsidian Vaults'       },
    ],
  },
  {
    type: 'group',
    id: 'analytics',
    icon: BarChart2,
    label: 'Analytics',
    color: 'var(--navy-500)',
    items: [
      { to: routePaths.analytics,      icon: BarChart2,     label: 'Claude Analytics' },
      { to: routePaths.semanticLayer,  icon: Database,      label: 'Semantic Layer'   },
      { to: routePaths.codexAnalytics, icon: BarChart2,     label: 'Codex Analytics'  },
      { to: routePaths.geminiAnalytics, icon: BarChart2,    label: 'Gemini Analytics' },
      { to: routePaths.goalMonitor,    icon: Target,        label: 'Goal Monitor'     },
      { to: routePaths.evals,          icon: ClipboardCheck, label: 'Evals'           },
    ],
  },
  {
    type: 'group',
    id: 'insights',
    icon: Lightbulb,
    label: 'Insights',
    color: 'var(--navy-500)',
    items: [
      { to: routePaths.insights,  icon: Lightbulb, label: 'Insights' },
      { to: routePaths.advisor,   icon: Sparkles,  label: 'Advisor'  },
      { to: routePaths.changelog, icon: Megaphone, label: 'Updates'  },
    ],
  },
  {
    type: 'group',
    id: 'research',
    icon: FlaskConical,
    label: 'Research',
    color: '#a855f7',
    items: [
      { to: routePaths.news,          icon: Newspaper,    label: 'News'              },
      { to: routePaths.research,      icon: FlaskConical, label: 'Research Pipeline' },
      { to: routePaths.videoResearch, icon: Film,         label: 'Video Research'    },
    ],
  },
  {
    type: 'group',
    id: 'code',
    icon: GitBranch,
    label: 'Code',
    color: '#3b82f6',
    items: [
      { to: routePaths.github,    icon: GitBranch, label: 'GitHub'    },
      { to: routePaths.gitTree,   icon: GitBranch, label: 'Git Tree'  },
      { to: routePaths.docker,    icon: Container, label: 'Docker'    },
    ],
  },
  {
    type: 'group',
    id: 'business',
    icon: Briefcase,
    label: 'Business',
    color: '#f59e0b',
    items: [
      { to: routePaths.crm,       icon: Users,       label: 'Clients (CRM)' },
      { to: routePaths.invoicing, icon: ReceiptText, label: 'Invoicing'     },
    ],
  },
  {
    type: 'group',
    id: 'governance',
    icon: ShieldCheck,
    label: 'Governance',
    color: 'var(--steel-500)',
    navKey: 'governance',
    items: [
      { to: routePaths.mcpServers,  icon: ShieldCheck, label: 'MCP Servers'  },
      { to: routePaths.hooks,       icon: Zap,         label: 'Hooks'        },
      { to: routePaths.rules,       icon: ShieldCheck, label: 'Rules'        },
      { to: routePaths.cacheHealth, icon: ShieldCheck, label: 'Cache Health' },
    ],
  },
  {
    type: 'group',
    id: 'settings',
    icon: Settings,
    label: 'Settings',
    color: 'var(--ds-neutral-500)',
    items: [
      { to: routePaths.settings, icon: Settings,   label: 'Settings'            },
      { to: routePaths.health,   icon: HeartPulse, label: 'Health', navKey: 'health' },
      { to: routePaths.history,  icon: History,    label: 'History'             },
    ],
  },
];

function findGroupForPath(path: string): string | null {
  for (const entry of NAV_ENTRIES) {
    if (entry.type === 'group') {
      if (entry.items.some((item) => path === item.to || path.startsWith(item.to + '/'))) {
        return entry.id;
      }
    }
  }
  return null;
}

export function Sidebar() {
  const { sidebarVariant } = useTheme();
  const isRail = sidebarVariant === 'rail';
  const location = useLocation();

  const { connected } = useSSE();
  const { data: sessions } = useActiveSessions();
  const alive = sessions?.filter((s) => s.isAlive) ?? [];
  const { data: healthData } = useQuery({
    queryKey: queryKeys.healthReferences(),
    queryFn: fetchHealthReferences,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const healthIssues = healthData?.count ?? 0;

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = findGroupForPath(location.pathname);
    return initial ? new Set([initial]) : new Set();
  });

  useEffect(() => {
    const groupId = findGroupForPath(location.pathname);
    if (groupId) {
      setOpenGroups((prev) => {
        if (prev.has(groupId)) return prev;
        return new Set([...prev, groupId]);
      });
    }
  }, [location.pathname]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <aside className="aos-sidebar">
      {/* Brand */}
      <div className="aos-sidebar-brand">
        {isRail ? (
          <div className="aos-sidebar-mark" style={{ background: 'none', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
            <img
              src="/logo.png"
              alt="Agentic OS"
              style={{ width: 32, height: 32, objectFit: 'cover', objectPosition: 'left center', display: 'block' }}
            />
          </div>
        ) : (
          <img
            src="/logo.png"
            alt="Agentic OS"
            style={{ height: 38, width: 'auto', objectFit: 'contain', display: 'block', flexShrink: 0 }}
          />
        )}
        <div
          className="live-dot"
          style={{
            width: 6, height: 6,
            borderRadius: '50%',
            marginLeft: 'auto',
            flexShrink: 0,
            background: connected ? 'var(--green-500)' : 'var(--ds-neutral-500)',
            transition: 'background 0.3s',
          }}
          title={connected ? 'Live updates active' : 'Connecting…'}
        />
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '8px 0' }}>
        {NAV_ENTRIES.map((entry) => {
          if (entry.type === 'link') {
            const Icon = entry.icon;
            return (
              <div key={entry.to} className="aos-sidebar-nav">
                <NavLink
                  to={entry.to}
                  end={entry.to === routePaths.plans}
                  className={({ isActive }) => cn('aos-sidebar-link', isActive && 'active')}
                >
                  <Icon size={15} style={{ flexShrink: 0, color: entry.color }} />
                  {!isRail && <span style={{ flex: 1 }}>{entry.label}</span>}
                  {isRail && (
                    <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {entry.label.split(' ')[0]}
                    </span>
                  )}
                  {!isRail && entry.navKey === 'sessions' && alive.length > 0 && (
                    <span className="count-badge">{alive.length}</span>
                  )}
                </NavLink>
              </div>
            );
          }

          const Icon = entry.icon;
          const isOpen = openGroups.has(entry.id);
          const hasActiveChild = entry.items.some(
            (item) => location.pathname === item.to || location.pathname.startsWith(item.to + '/'),
          );

          return (
            <div key={entry.id} className="aos-sidebar-nav">
              {/* Group header */}
              <button
                className={cn('aos-sidebar-link', hasActiveChild && !isOpen && 'active')}
                style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onClick={() => toggleGroup(entry.id)}
                aria-expanded={isOpen}
              >
                <Icon size={15} style={{ flexShrink: 0, color: entry.color }} />
                {!isRail && <span style={{ flex: 1 }}>{entry.label}</span>}
                {isRail && (
                  <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {entry.label.split(' ')[0]}
                  </span>
                )}
                {!isRail && entry.navKey === 'sessions' && alive.length > 0 && (
                  <span className="count-badge">{alive.length}</span>
                )}
                {!isRail && entry.navKey === 'health' && healthIssues > 0 && (
                  <span className="count-badge" style={{ background: 'rgba(217,64,64,0.2)', color: '#f87171' }}>
                    {healthIssues}
                  </span>
                )}
                {!isRail && (
                  <ChevronDown
                    size={13}
                    style={{
                      flexShrink: 0,
                      color: 'var(--sidebar-fg-dim)',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform var(--transition-fast-ds)',
                      marginLeft: entry.navKey ? 4 : 0,
                    }}
                  />
                )}
              </button>

              {/* Sub-items */}
              {isOpen && !isRail && (
                <div style={{ paddingLeft: 8, marginTop: 2, marginBottom: 4 }}>
                  {entry.items.map((item) => {
                    const SubIcon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === routePaths.conversations}
                        className={({ isActive }) => cn('aos-sidebar-link aos-sidebar-sublink', isActive && 'active')}
                      >
                        {item.agentColor ? (
                          <span
                            className="agent-dot"
                            style={{ background: `var(--agent-${item.agentColor})` }}
                          />
                        ) : (
                          <SubIcon size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
                        )}
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.navKey === 'health' && healthIssues > 0 && (
                          <span className="count-badge" style={{ background: 'rgba(217,64,64,0.2)', color: '#f87171' }}>
                            {healthIssues}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active sessions footer */}
      {alive.length > 0 && !isRail && (
        <div style={{ borderTop: '1px solid var(--sidebar-border)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--sidebar-fg-dim)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green-500)', display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            Active Sessions
          </div>
          {alive.slice(0, 3).map((s) => (
            <div key={s.pid} className="aos-session-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono-ds)', fontSize: '11px', color: 'var(--sidebar-fg)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {shortPath(s.cwd)}
                </span>
                {s.bridgeSessionId && (
                  <span title="Remote control active" style={{ color: '#60a5fa', flexShrink: 0, display: 'flex' }}>
                    <Radio size={10} />
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sidebar-fg-dim)', marginTop: 2, fontFamily: 'var(--font-mono-ds)' }}>
                {s.kind} · {relativeTime(s.startedAt)}
              </div>
            </div>
          ))}
          {alive.length > 3 && (
            <div style={{ fontSize: '11px', color: 'var(--sidebar-fg-dim)', textAlign: 'center' }}>
              +{alive.length - 3} more
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="aos-sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--navy-500), var(--steel-500))',
            color: '#fff', display: 'grid', placeItems: 'center',
            fontWeight: 700, fontSize: '12px', flexShrink: 0,
          }}>
            A
          </div>
          {!isRail && (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>Agentic OS</span>
              <span style={{ fontFamily: 'var(--font-mono-ds)', fontSize: '10.5px', color: 'var(--sidebar-fg-dim)' }}>
                ~/.claude · ~/.codex
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
