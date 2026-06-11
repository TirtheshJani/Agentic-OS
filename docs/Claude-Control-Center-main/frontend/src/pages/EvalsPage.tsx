import 'chart.js/auto';
import { useState } from 'react';
import { Doughnut, Line } from 'react-chartjs-2';
import {
  ClipboardCheck, RefreshCw, X, ChevronRight, GitCommit,
  AlertTriangle, CheckCircle, Loader2, FolderCode,
} from 'lucide-react';
import { useEvalSessions, useEvalStats, useEvalBudget, useGradeSession, useScanUngraded, useUpdateSessionRepo } from '../hooks/useEvals';
import type { EvalResult, EvalStats } from '../types';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Chart theme — plain hex/rgba only (no CSS vars or oklch for Chart.js)
// ---------------------------------------------------------------------------
const ACCENT   = '#0ecbbe';
const GREEN    = '#3ec85e';
const AMBER    = '#d29922';
const ORANGE   = '#f97316';
const RED      = '#ef4444';
const MUTED    = '#8b949e';
const TICK_COLOR  = '#8b949e';
const GRID_COLOR  = 'rgba(255,255,255,0.05)';
const TOOLTIP_BG  = 'rgba(13,17,23,0.95)';

const GRADE_COLORS: Record<string, string> = {
  A: GREEN, B: ACCENT, C: AMBER, D: ORANGE, F: RED,
};

const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: TICK_COLOR, font: { size: 11 } } },
    tooltip: { backgroundColor: TOOLTIP_BG, titleColor: '#e6edf3', bodyColor: TICK_COLOR },
  },
  scales: {
    x: { ticks: { color: TICK_COLOR, font: { size: 10 } }, grid: { color: GRID_COLOR } },
    y: { ticks: { color: TICK_COLOR, font: { size: 10 } }, grid: { color: GRID_COLOR } },
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gradeColor(grade: string): string {
  return GRADE_COLORS[grade] ?? MUTED;
}

function gradeBackground(grade: string): string {
  const c = gradeColor(grade);
  return `${c}22`;
}

function fmtScore(n: number | undefined) {
  return n != null ? n.toFixed(1) : '—';
}

function fmtDate(ts: string | undefined) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
  } catch { return ts.slice(0, 10); }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card px-4 py-3 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </span>
      <span className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </span>
      {sub && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</span>}
    </div>
  );
}

function GradePill({ grade, score }: { grade: string; score?: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
      style={{ color: gradeColor(grade), background: gradeBackground(grade) }}
    >
      {grade}{score != null ? ` · ${fmtScore(score)}` : ''}
    </span>
  );
}

function ToolBadge({ tool }: { tool: string }) {
  const map: Record<string, string> = { claude: 'Claude Code', codex: 'Codex CLI' };
  const color = tool === 'claude' ? 'var(--accent)' : '#f97316';
  return (
    <span className="chip text-xs" style={{ color, borderColor: `${color}44`, background: `${color}11` }}>
      {map[tool] ?? tool}
    </span>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span>{label}</span>
        <span style={{ color }}>{fmtScore(score)}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(score, 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scorecard Drawer
// ---------------------------------------------------------------------------

function ScorecardDrawer({ result, onClose }: { result: EvalResult; onClose: () => void }) {
  const { mutate: grade, isPending: grading } = useGradeSession();
  const { mutate: updateRepo } = useUpdateSessionRepo();
  const [editingRepo, setEditingRepo] = useState(false);
  const [repoInput, setRepoInput] = useState(result.repo_override ?? result.git?.repo ?? '');
  const [judgeOpen, setJudgeOpen] = useState(false);

  const handleRepoSave = () => {
    if (repoInput.trim()) {
      updateRepo({ sessionId: result.session_id, repoPath: repoInput.trim() });
    }
    setEditingRepo(false);
  };

  const git = result.git;
  const staticInfo = result.static;

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex flex-col"
      style={{
        width: 'min(560px, 100vw)',
        background: 'var(--surface-1)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {result.project || result.session_id}
          </div>
          <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
            <ToolBadge tool={result.tool} />
            <span>{fmtDate(result.last_ts)}</span>
            <span className="capitalize">{result.task_category}</span>
          </div>
        </div>
        <button
          onClick={() => grade(result.session_id)}
          disabled={grading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs"
          style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          {grading
            ? <Loader2 size={11} className="animate-spin" />
            : <RefreshCw size={11} />}
          Re-grade
        </button>
        <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }}>
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {/* Grade circle + composite */}
        <div className="flex items-center gap-5">
          <div
            className="flex flex-col items-center justify-center rounded-full flex-shrink-0"
            style={{
              width: 72, height: 72,
              background: gradeBackground(result.grade),
              border: `2px solid ${gradeColor(result.grade)}`,
            }}
          >
            <span className="text-2xl font-bold" style={{ color: gradeColor(result.grade) }}>
              {result.grade}
            </span>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <div className="text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {fmtScore(result.composite_score)}
              <span className="text-base font-normal ml-1" style={{ color: 'var(--text-tertiary)' }}>/100</span>
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Graded {fmtDate(result.graded_at)}
            </div>
          </div>
        </div>

        {/* Dimension bars */}
        <div className="card px-4 py-4 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
            Score Breakdown
          </div>
          <ScoreBar label="Token Efficiency (30%)" score={result.token_efficiency?.score ?? 0} color={ACCENT} />
          <ScoreBar label="Code Quality (40%)" score={result.code_quality?.score ?? 0} color={GREEN} />
          <ScoreBar label="Coherence (30%)" score={result.coherence?.score ?? 0} color={AMBER} />
        </div>

        {/* LLM Judge accordion */}
        <div className="card px-4 py-3">
          <button
            className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)' }}
            onClick={() => setJudgeOpen(o => !o)}
          >
            <span>AI Judge Rubric</span>
            <ChevronRight size={12} className={cn('transition-transform', judgeOpen && 'rotate-90')} />
          </button>
          {judgeOpen && result.judge && (
            <div className="mt-3 flex flex-col gap-3">
              {(['prompt_clarity', 'token_efficiency', 'agent_accuracy', 'code_elegance'] as const).map(dim => {
                const entry = result.judge[dim];
                if (!entry) return null;
                const label = {
                  prompt_clarity: 'Prompt Clarity',
                  token_efficiency: 'Token Efficiency',
                  agent_accuracy: 'Agent Accuracy',
                  code_elegance: 'Code Elegance',
                }[dim];
                return (
                  <div key={dim}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      <span className="text-xs font-semibold" style={{ color: entry.score >= 70 ? GREEN : entry.score >= 50 ? AMBER : RED }}>
                        {entry.score}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{entry.reason}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Git section */}
        <div className="card px-4 py-4 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
            Git Activity
          </div>
          {/* Repo path (editable) */}
          <div className="flex items-center gap-2">
            <FolderCode size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            {editingRepo ? (
              <div className="flex gap-2 flex-1">
                <input
                  className="input-field text-xs flex-1"
                  value={repoInput}
                  onChange={e => setRepoInput(e.target.value)}
                  placeholder="/path/to/repo"
                />
                <button className="btn-primary text-xs px-2 py-1" onClick={handleRepoSave}>Save</button>
                <button className="text-xs px-2 py-1" style={{ color: 'var(--text-tertiary)' }} onClick={() => setEditingRepo(false)}>Cancel</button>
              </div>
            ) : (
              <button
                className="text-xs truncate text-left flex-1"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => setEditingRepo(true)}
                title="Click to override repo path"
              >
                {result.repo_override ?? git?.repo ?? 'No repo detected — click to set'}
              </button>
            )}
          </div>
          {/* Diff stats */}
          {git && git.commit_count > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Commits', value: git.commit_count },
                { label: 'Files', value: git.files_changed },
                { label: 'Lines', value: `+${git.insertions} -${git.deletions}` },
              ].map(item => (
                <div key={item.label} className="text-center rounded py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.value}</div>
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No commits detected during this session.</p>
          )}
          {/* Recent commits */}
          {git?.commits?.slice(0, 5).map(c => (
            <div key={c.hash} className="flex items-start gap-2">
              <GitCommit size={11} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <div className="min-w-0">
                <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{c.subject}</div>
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.hash.slice(0, 7)} · {fmtDate(c.date)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Static analysis */}
        {staticInfo && staticInfo.available_tools.length > 0 && (
          <div className="card px-4 py-4 flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
              Static Analysis
            </div>
            {staticInfo.ts_errors != null && (
              <div className="flex items-center gap-2">
                {staticInfo.ts_errors === 0
                  ? <CheckCircle size={12} style={{ color: GREEN }} />
                  : <AlertTriangle size={12} style={{ color: AMBER }} />}
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  TypeScript: {staticInfo.ts_errors} error{staticInfo.ts_errors !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {staticInfo.pylint_errors != null && (
              <div className="flex items-center gap-2">
                {staticInfo.pylint_errors === 0
                  ? <CheckCircle size={12} style={{ color: GREEN }} />
                  : <AlertTriangle size={12} style={{ color: AMBER }} />}
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Pylint: {staticInfo.pylint_errors} error{staticInfo.pylint_errors !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

function OverviewTab({ stats }: { stats: EvalStats }) {
  const grades = ['A', 'B', 'C', 'D', 'F'];
  const dist = stats.grade_distribution;

  const doughnutData = {
    labels: grades,
    datasets: [{
      data: grades.map(g => dist[g] ?? 0),
      backgroundColor: grades.map(g => gradeColor(g)),
      borderWidth: 0,
    }],
  };

  const trendLabels = stats.trend.map(t => t.date.slice(5));
  const trendData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Avg Score',
        data: stats.trend.map(t => t.avg_score),
        borderColor: ACCENT,
        backgroundColor: `${ACCENT}22`,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
      },
    ],
  };

  const abCount = (dist['A'] ?? 0) + (dist['B'] ?? 0);
  const dfCount = (dist['D'] ?? 0) + (dist['F'] ?? 0);
  const abPct = stats.graded > 0 ? Math.round((abCount / stats.graded) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Avg Score" value={fmtScore(stats.avg_score)} sub="composite" />
        <StatCard label="Sessions Graded" value={stats.graded} sub={`of ${stats.total} total`} />
        <StatCard label="A/B Sessions" value={`${abPct}%`} sub={`${abCount} sessions`} />
        <StatCard label="Flagged (D/F)" value={dfCount} sub="need attention" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card px-4 py-4 flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            Grade Distribution
          </span>
          <div style={{ height: 180 }}>
            <Doughnut
              data={doughnutData}
              options={{
                ...baseChartOptions,
                plugins: {
                  ...baseChartOptions.plugins,
                  legend: { position: 'bottom', labels: { color: TICK_COLOR, font: { size: 10 }, boxWidth: 10 } },
                },
              }}
            />
          </div>
        </div>

        <div className="card px-4 py-4 flex flex-col gap-3 lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            Score Trend
          </span>
          {stats.trend.length > 0 ? (
            <div style={{ height: 180 }}>
              <Line data={trendData} options={{ ...baseChartOptions, scales: { ...baseChartOptions.scales, y: { ...baseChartOptions.scales.y, min: 0, max: 100 } } }} />
            </div>
          ) : (
            <div className="flex items-center justify-center flex-1" style={{ height: 180, color: 'var(--text-tertiary)', fontSize: 13 }}>
              Not enough data yet
            </div>
          )}
        </div>
      </div>

      {/* By tool breakdown */}
      {Object.keys(stats.by_tool).length > 0 && (
        <div className="card px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
            By Tool
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(stats.by_tool).map(([tool, info]) => (
              <div key={tool} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <ToolBadge tool={tool} />
                <div className="mt-2 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtScore(info.avg_score)}</div>
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{info.count} sessions</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flagged sessions */}
      {stats.flagged.length > 0 && (
        <div className="card px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={13} style={{ color: ORANGE }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              Flagged Sessions (D/F)
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {stats.flagged.slice(0, 5).map(r => (
              <div key={r.session_id} className="flex items-center gap-3 text-xs">
                <GradePill grade={r.grade} score={r.composite_score} />
                <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{r.project || r.session_id}</span>
                <span className="ml-auto flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{fmtDate(r.last_ts)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sessions tab
// ---------------------------------------------------------------------------

type ToolFilter = '' | 'claude' | 'codex';
type GradeFilter = '' | 'A' | 'B' | 'C' | 'D' | 'F';

function SessionsTab({
  onSelect,
}: {
  onSelect: (r: EvalResult) => void;
}) {
  const [toolFilter, setToolFilter] = useState<ToolFilter>('');
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('');
  const [days, setDays] = useState<number | 'all'>(30);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useEvalSessions(days, toolFilter || undefined, gradeFilter || undefined, page);
  const sessions = data?.sessions ?? [];
  const total = data?.total ?? 0;

  const { mutate: grade, isPending: grading } = useGradeSession();

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Days */}
        {([30, 90, 'all'] as const).map(d => (
          <button
            key={String(d)}
            className="chip text-xs"
            style={{
              background: days === d ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
              color: days === d ? 'var(--accent)' : 'var(--text-secondary)',
            }}
            onClick={() => { setDays(d); setPage(1); }}
          >
            {d === 'all' ? 'All time' : `${d}d`}
          </button>
        ))}
        <div className="w-px h-4 mx-1" style={{ background: 'var(--border)' }} />
        {/* Tool filter */}
        {(['', 'claude', 'codex'] as const).map(t => (
          <button
            key={t}
            className="chip text-xs"
            style={{
              background: toolFilter === t ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
              color: toolFilter === t ? 'var(--accent)' : 'var(--text-secondary)',
            }}
            onClick={() => { setToolFilter(t); setPage(1); }}
          >
            {t === '' ? 'All tools' : t === 'claude' ? 'Claude Code' : 'Codex CLI'}
          </button>
        ))}
        <div className="w-px h-4 mx-1" style={{ background: 'var(--border)' }} />
        {/* Grade filter */}
        {(['', 'A', 'B', 'C', 'D', 'F'] as const).map(g => (
          <button
            key={g}
            className="chip text-xs"
            style={{
              background: gradeFilter === g ? `${g ? gradeColor(g) : 'var(--accent)'}22` : 'rgba(255,255,255,0.05)',
              color: gradeFilter === g ? (g ? gradeColor(g) : 'var(--accent)') : 'var(--text-secondary)',
            }}
            onClick={() => { setGradeFilter(g); setPage(1); }}
          >
            {g === '' ? 'All grades' : g}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16" style={{ color: 'var(--text-tertiary)' }}>
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No sessions graded yet. Click "Scan &amp; Grade" to begin.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>
                {['Date', 'Project', 'Tool', 'Category', 'Grade', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map(r => (
                <tr
                  key={r.session_id}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                  onClick={() => onSelect(r)}
                >
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)' }}>{fmtDate(r.last_ts)}</td>
                  <td className="px-4 py-2.5 max-w-xs truncate" style={{ color: 'var(--text-secondary)' }}>{r.project || r.session_id.slice(0, 12)}</td>
                  <td className="px-4 py-2.5"><ToolBadge tool={r.tool} /></td>
                  <td className="px-4 py-2.5 capitalize" style={{ color: 'var(--text-tertiary)' }}>{r.task_category}</td>
                  <td className="px-4 py-2.5"><GradePill grade={r.grade} score={r.composite_score} /></td>
                  <td className="px-4 py-2.5">
                    <button
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                      style={{ color: 'var(--text-tertiary)', border: '1px solid var(--border)' }}
                      onClick={e => { e.stopPropagation(); grade(r.session_id); }}
                      disabled={grading}
                      title="Re-grade"
                    >
                      <RefreshCw size={10} className={grading ? 'animate-spin' : ''} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center gap-2 justify-end text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <span>{(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}</span>
          <button className="chip" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <button className="chip" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type Tab = 'overview' | 'sessions';

export function EvalsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [selected, setSelected] = useState<EvalResult | null>(null);
  const [days] = useState<number | 'all'>(30);

  const { data: stats, isLoading: statsLoading } = useEvalStats(days);
  const { data: budget } = useEvalBudget();
  const { mutate: scan, isPending: scanning } = useScanUngraded();

  return (
    <div
      className="flex flex-col"
      style={{ height: '100%', overflowY: 'auto', position: 'relative' }}
    >
      <div className="p-6 flex flex-col gap-5" style={{ minHeight: '100%' }}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <ClipboardCheck size={18} style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Evals</h1>
          <div className="flex-1" />
          {/* Budget indicator */}
          {budget && (
            <div className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.05)' }}>
              Judge: ${budget.spent_usd.toFixed(3)} / ${budget.limit_usd.toFixed(2)} today
            </div>
          )}
          <button
            onClick={() => scan(100)}
            disabled={scanning}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium"
            style={{ color: 'var(--accent)', border: '1px solid var(--accent)', background: 'var(--accent-dim)' }}
          >
            {scanning ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {scanning ? 'Grading…' : 'Scan & Grade'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['overview', 'sessions'] as const).map(t => (
            <button
              key={t}
              className="chip capitalize"
              style={{
                background: tab === t ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
                color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
              }}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview' && (
          statsLoading ? (
            <div className="flex items-center gap-2 py-16 justify-center" style={{ color: 'var(--text-tertiary)' }}>
              <Loader2 size={16} className="animate-spin" /> Loading stats…
            </div>
          ) : stats ? (
            <OverviewTab stats={stats} />
          ) : (
            <div className="text-center py-16 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              No eval data yet. Click "Scan &amp; Grade" to begin.
            </div>
          )
        )}

        {tab === 'sessions' && (
          <SessionsTab onSelect={r => setSelected(r)} />
        )}
      </div>

      {/* Scorecard drawer overlay */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setSelected(null)}
          />
          <ScorecardDrawer result={selected} onClose={() => setSelected(null)} />
        </>
      )}
    </div>
  );
}
