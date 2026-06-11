import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { Link } from 'react-router-dom';
import { fetchAnalyticsStats, fetchCodeburnStats } from '../api/analytics';
import { fetchHealthReferences } from '../api/health';
import { fetchMcpServers } from '../api/mcpServers';
import { fetchHooks } from '../api/hooks';
import { fetchRules } from '../api/rules';
import { useFleet } from '../hooks/useDashboard';
import type { FleetActiveSession } from '../api/dashboard';
import { useSSE } from '../hooks/useSSE';
import { ArrowRight, Plus, Terminal, RefreshCw, Zap, Server, ShieldCheck, DollarSign, Activity } from 'lucide-react';

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function formatCAD(usd: number, rate: number): string {
  const cad = usd * rate;
  if (cad < 0.01) return 'CA$0.00';
  if (cad >= 1000) return `CA$${(cad / 1000).toFixed(1)}K`;
  return `CA$${cad.toFixed(2)}`;
}

function shortId(s?: string, n = 6): string {
  if (!s) return '—';
  return s.length <= n ? s : s.slice(-n);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

// Mini sparkline SVG
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 80, h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * (h - 2);
    return `${x},${y}`;
  });
  const area = `M${pts[0]} L${pts.join(' L')} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="aos-sparkline">
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace(/[^a-z]/gi, '')})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Status bar
function StatusLine({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
        <span style={{ color: 'var(--app-fg-muted)', fontFamily: 'var(--font-body-ds)' }}>{label}</span>
        <span style={{ color: 'var(--app-fg)', fontWeight: 600, fontFamily: 'var(--font-mono-ds)' }}>{value}</span>
      </div>
      <div style={{ height: 3, background: 'var(--aos-border)', borderRadius: 99 }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

// Agent tile
function AgentTile({
  agentId, label, active, queued, failed, idle, value, unit, sparkline, pctOfTotal, color,
}: {
  agentId: string; label: string; active: number; queued: number;
  failed: number; idle: number; value: number; unit: string;
  sparkline: number[]; pctOfTotal: number; color: string;
}) {
  return (
    <div className="col-span-3 aos-card" style={{ borderTop: `3px solid ${color}`, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className={`aos-agent-pill ${agentId}`}>{label}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono-ds)', fontSize: '11px', color: 'var(--app-fg-dim)' }}>
            {pctOfTotal}% of fleet
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <Stat label="Active" value={active} color="var(--green-500)" />
          <Stat label="Queued" value={queued} color="var(--orange-500)" />
          <Stat label="Failed" value={failed} color="#d94040" />
          <Stat label="Idle" value={idle} color="var(--app-fg-dim)" />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono-ds)', fontSize: '18px', fontWeight: 600, color: 'var(--app-fg)', lineHeight: 1 }}>
              {fmt(value)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--app-fg-dim)', marginTop: 2 }}>{unit} · 24h</div>
          </div>
          <Sparkline data={sparkline} color={color} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: '18px', fontWeight: 700, color, fontFamily: 'var(--font-display-ds)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--app-fg-dim)', marginTop: 1, fontFamily: 'var(--font-body-ds)' }}>
        {label}
      </div>
    </div>
  );
}

const AGENT_LABELS: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
};

// Session row in table
function SessionRow({ session }: { session: FleetActiveSession }) {
  const projectName = session.project || session.cwd.split('/').pop() || session.cwd || '—';
  const agent = session.agent;
  const identifier = session.pid > 0 ? `PID ${session.pid}` : shortId(session.sessionId);
  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`aos-agent-pill ${agent}`}>{AGENT_LABELS[agent] ?? agent}</span>
          <span style={{ fontFamily: 'var(--font-mono-ds)', fontSize: '12px', color: 'var(--app-fg-muted)' }}>
            {projectName}
          </span>
        </div>
      </td>
      <td>
        <span className={`aos-status-pill ${session.isAlive ? 'running' : 'idle'}`}>
          {session.isAlive ? 'Running' : 'Idle'}
        </span>
      </td>
      <td style={{ fontFamily: 'var(--font-mono-ds)', fontSize: '12px', color: 'var(--app-fg-muted)' }}>
        {session.kind}
      </td>
      <td style={{ fontFamily: 'var(--font-mono-ds)', fontSize: '11px', color: 'var(--app-fg-dim)' }}>
        {identifier}
      </td>
    </tr>
  );
}

// KPI card
function KpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="aos-card aos-card-pad" style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}18`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon size={17} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--app-fg-dim)', fontFamily: 'var(--font-body-ds)' }}>
          {label}
        </div>
        <div style={{ fontFamily: 'var(--font-display-ds)', fontSize: '26px', fontWeight: 700, color: 'var(--app-fg)', lineHeight: 1.1, marginTop: 2 }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: '11px', color: 'var(--app-fg-dim)', marginTop: 3 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { connected } = useSSE();
  const queryClient = useQueryClient();
  const { data: fleet } = useFleet();

  const fleetSessions = fleet?.active_sessions ?? [];
  const alive = fleetSessions.filter((s) => s.isAlive);

  const { data: analytics } = useQuery({
    queryKey: queryKeys.analyticsStats(7),
    queryFn: () => fetchAnalyticsStats(7),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });

  const { data: codeburn } = useQuery({
    queryKey: queryKeys.codeburnStats(7),
    queryFn: () => fetchCodeburnStats(7),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: healthData } = useQuery({
    queryKey: queryKeys.healthReferences(),
    queryFn: fetchHealthReferences,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: mcpServers } = useQuery({
    queryKey: queryKeys.mcpServers(),
    queryFn: () => fetchMcpServers(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: hooks } = useQuery({
    queryKey: queryKeys.hooks(),
    queryFn: () => fetchHooks(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: rules } = useQuery({
    queryKey: queryKeys.rules(),
    queryFn: () => fetchRules(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const totalSessions = analytics?.overview.total_sessions ?? 0;
  const totalMessages = analytics?.overview.total_messages ?? 0;
  const totalTokensIn  = analytics?.tokens.input_tokens ?? 0;
  const totalTokensOut = analytics?.tokens.output_tokens ?? 0;
  const totalTokens = totalTokensIn + totalTokensOut;

  const hookCount = hooks
    ? Object.values(hooks).reduce((acc: number, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0)
    : 0;

  const ruleCount = rules ? ((rules.allow?.length ?? 0) + (rules.deny?.length ?? 0)) : 0;
  const mcpCount = mcpServers?.length ?? 0;
  const healthIssues = healthData?.count ?? 0;

  const exchangeRate = codeburn?.exchange_rate ?? 1;
  const totalCostDisplay = codeburn
    ? formatCAD(codeburn.total_cost_usd, exchangeRate)
    : '—';
  const cacheHitPct = codeburn?.cache_efficiency.cache_hit_pct;

  const fleetAgents = fleet?.agents ?? [];
  const fleetTotal7d = fleetAgents.reduce((acc, a) => acc + (a.value_7d || 0), 0);
  const fleetColors: Record<string, string> = {
    claude: 'var(--agent-claude)',
    codex: 'var(--agent-codex)',
    gemini: 'var(--agent-gemini)',
  };

  return (
    <div className="aos-page animate-fade-in">
      {/* ── HERO ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'stretch', marginBottom: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--app-fg-dim)', fontFamily: 'var(--font-body-ds)', marginBottom: 8 }}>
              Command Center · {todayLabel()}
            </div>
            <h1 style={{ fontFamily: 'var(--font-display-ds)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--app-fg)', margin: 0, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
              {greeting()}.
            </h1>
            <p style={{ color: 'var(--app-fg-muted)', margin: '10px 0 0', maxWidth: 620, fontSize: '14px', lineHeight: 1.6, fontFamily: 'var(--font-body-ds)' }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--green-500)' : 'var(--ds-neutral-500)', marginRight: 8, verticalAlign: 'middle', animation: connected ? 'pulse-dot 2s ease-in-out infinite' : 'none' }} />
              <strong style={{ color: 'var(--app-fg)' }}>{alive.length} session{alive.length !== 1 ? 's' : ''}</strong> active across all agents.
              {healthIssues > 0 && (
                <span> <strong style={{ color: '#f87171' }}>{healthIssues} health issue{healthIssues !== 1 ? 's' : ''}</strong> need attention.</span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/conversations" className="aos-btn primary">
              <Plus size={14} /> Start session
            </Link>
            <Link to="/conversations" className="aos-btn secondary">
              <Terminal size={14} /> Open CLI
            </Link>
            <Link to="/plans" className="aos-btn secondary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              New plan
            </Link>
          </div>
        </div>

        {/* System status */}
        <div className="aos-card" style={{ minWidth: 260, maxWidth: 320 }}>
          <div className="aos-card-h">
            <h3>System Status</h3>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--green-500)', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-body-ds)' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green-500)', display: 'inline-block' }} />
              nominal
            </span>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <StatusLine
              label="MCP bridges"
              value={`${mcpCount} configured`}
              color="var(--green-500)"
              pct={mcpCount > 0 ? 100 : 0}
            />
            <StatusLine
              label="Hook engine"
              value={`${hookCount} active`}
              color="var(--green-500)"
              pct={hookCount > 0 ? 100 : 0}
            />
            <StatusLine
              label="Rules"
              value={`${ruleCount} enforced`}
              color="var(--steel-500)"
              pct={100}
            />
            <StatusLine
              label="Health issues"
              value={healthIssues === 0 ? 'All clear' : `${healthIssues} found`}
              color={healthIssues === 0 ? 'var(--green-500)' : '#d94040'}
              pct={healthIssues === 0 ? 100 : Math.min(healthIssues * 10, 100)}
            />
            <StatusLine
              label="Active sessions"
              value={`${alive.length} running`}
              color="var(--orange-500)"
              pct={Math.min(alive.length * 20, 100)}
            />
          </div>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard
          label="Sessions (7d)"
          value={fmt(totalSessions)}
          sub={`${analytics?.overview.active_days ?? 0} active days`}
          icon={Activity}
          color="var(--orange-500)"
        />
        <KpiCard
          label="Messages (7d)"
          value={fmt(totalMessages)}
          sub={`${analytics?.overview.total_tool_calls ? fmt(analytics.overview.total_tool_calls) : '—'} tool calls`}
          icon={svg => <MessageSquareIcon {...svg} />}
          color="var(--steel-500)"
        />
        <KpiCard
          label="Tokens (7d)"
          value={fmt(totalTokens)}
          sub={`${fmt(totalTokensIn)} in · ${fmt(totalTokensOut)} out`}
          icon={Zap}
          color="var(--green-500)"
        />
        <KpiCard
          label="Est. cost (7d)"
          value={totalCostDisplay}
          sub={cacheHitPct != null ? `${cacheHitPct}% cache hit` : 'Claude API only'}
          icon={DollarSign}
          color="var(--navy-500)"
        />
      </div>

      {/* ── AGENT FLEET ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--app-fg-dim)', fontFamily: 'var(--font-body-ds)', marginBottom: 4 }}>
              Agents
            </div>
            <h2 style={{ fontFamily: 'var(--font-display-ds)', fontSize: '22px', fontWeight: 600, margin: 0, color: 'var(--app-fg)' }}>
              Fleet at a glance
            </h2>
          </div>
          <button
            className="aos-btn secondary sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.dashboardFleet() })}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {fleetAgents.map((a) => {
            const pct = fleetTotal7d > 0 ? Math.round((a.value_7d / fleetTotal7d) * 100) : 0;
            return (
              <AgentTile
                key={a.id}
                agentId={a.id}
                label={a.label}
                active={a.active}
                queued={a.queued}
                failed={a.failed}
                idle={a.idle}
                value={a.value_24h}
                unit={a.value_unit}
                sparkline={a.sparkline}
                pctOfTotal={pct}
                color={fleetColors[a.id] ?? 'var(--steel-500)'}
              />
            );
          })}
        </div>
      </div>

      {/* ── SESSIONS + GOVERNANCE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, marginBottom: 28 }}>
        {/* Active sessions table */}
        <div className="aos-card">
          <div className="aos-card-h">
            <h3>Active Sessions</h3>
            <span style={{ marginLeft: 4, fontSize: '12px', color: 'var(--green-500)', fontFamily: 'var(--font-mono-ds)' }}>
              {alive.length} live
            </span>
            <Link to="/conversations" className="aos-btn secondary sm" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
              View all <ArrowRight size={11} />
            </Link>
          </div>
          {alive.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--app-fg-dim)', fontSize: '13px', fontFamily: 'var(--font-body-ds)' }}>
              No active sessions. <Link to="/conversations" style={{ color: 'var(--aos-accent)', textDecoration: 'none' }}>Start one</Link>
            </div>
          ) : (
            <table className="aos-table">
              <thead>
                <tr>
                  <th>Agent / Project</th>
                  <th>Status</th>
                  <th>Kind</th>
                  <th>PID</th>
                </tr>
              </thead>
              <tbody>
                {alive.slice(0, 8).map((s) => (
                  <SessionRow key={`${s.agent}-${s.sessionId || s.pid}`} session={s} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Governance quick stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 220 }}>
          <Link to="/mcp-servers" className="aos-card aos-card-pad" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--agent-gemini-d)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Server size={17} style={{ color: 'var(--agent-gemini)' }} />
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-display-ds)', color: 'var(--app-fg)', lineHeight: 1 }}>{mcpCount}</div>
              <div style={{ fontSize: '11px', color: 'var(--app-fg-dim)', fontFamily: 'var(--font-body-ds)' }}>MCP servers</div>
            </div>
            <ArrowRight size={13} style={{ marginLeft: 'auto', color: 'var(--app-fg-dim)' }} />
          </Link>

          <Link to="/hooks" className="aos-card aos-card-pad" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--agent-codex-d)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Zap size={17} style={{ color: 'var(--agent-codex)' }} />
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-display-ds)', color: 'var(--app-fg)', lineHeight: 1 }}>{hookCount}</div>
              <div style={{ fontSize: '11px', color: 'var(--app-fg-dim)', fontFamily: 'var(--font-body-ds)' }}>Active hooks</div>
            </div>
            <ArrowRight size={13} style={{ marginLeft: 'auto', color: 'var(--app-fg-dim)' }} />
          </Link>

          <Link to="/rules" className="aos-card aos-card-pad" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--agent-claude-d)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <ShieldCheck size={17} style={{ color: 'var(--agent-claude)' }} />
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-display-ds)', color: 'var(--app-fg)', lineHeight: 1 }}>{ruleCount}</div>
              <div style={{ fontSize: '11px', color: 'var(--app-fg-dim)', fontFamily: 'var(--font-body-ds)' }}>Rules enforced</div>
            </div>
            <ArrowRight size={13} style={{ marginLeft: 'auto', color: 'var(--app-fg-dim)' }} />
          </Link>

          {healthIssues > 0 && (
            <Link to="/health" className="aos-card aos-card-pad" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, borderColor: 'rgba(217,64,64,0.3)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(217,64,64,0.1)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#d94040" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-display-ds)', color: '#d94040', lineHeight: 1 }}>{healthIssues}</div>
                <div style={{ fontSize: '11px', color: 'var(--app-fg-dim)', fontFamily: 'var(--font-body-ds)' }}>Health issues</div>
              </div>
              <ArrowRight size={13} style={{ marginLeft: 'auto', color: 'var(--app-fg-dim)' }} />
            </Link>
          )}
        </div>
      </div>

      {/* ── TOKEN USAGE CHART ── */}
      {analytics?.tokens.by_day && analytics.tokens.by_day.length > 0 && (
        <div className="aos-card" style={{ marginBottom: 28 }}>
          <div className="aos-card-h">
            <h3>Token usage · last 7 days</h3>
          </div>
          <div style={{ padding: 18 }}>
            <TokenChart data={analytics.tokens.by_day} />
          </div>
        </div>
      )}
    </div>
  );
}

// Inline icon for message square (avoids extra import)
function MessageSquareIcon({ size = 17, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

// Token chart — simple bar chart
function TokenChart({ data }: { data: { date: string; input: number; output: number }[] }) {
  const maxVal = Math.max(...data.map(d => d.input + d.output), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
      {data.map((d) => {
        const total = d.input + d.output;
        const pct = total / maxVal;
        return (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 64 }}>
              <div style={{ height: `${(d.output / maxVal) * 64}px`, background: 'var(--orange-400)', borderRadius: '2px 2px 0 0', minHeight: pct > 0 ? 1 : 0 }} />
              <div style={{ height: `${(d.input / maxVal) * 64}px`, background: 'var(--navy-400)', minHeight: pct > 0 ? 1 : 0 }} />
            </div>
            <div style={{ fontSize: '9px', color: 'var(--app-fg-dim)', fontFamily: 'var(--font-mono-ds)', whiteSpace: 'nowrap' }}>
              {d.date.slice(5)}
            </div>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingLeft: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '11px', color: 'var(--app-fg-dim)' }}>
          <div style={{ width: 10, height: 10, background: 'var(--navy-400)', borderRadius: 2 }} /> Input
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '11px', color: 'var(--app-fg-dim)' }}>
          <div style={{ width: 10, height: 10, background: 'var(--orange-400)', borderRadius: 2 }} /> Output
        </div>
      </div>
    </div>
  );
}
