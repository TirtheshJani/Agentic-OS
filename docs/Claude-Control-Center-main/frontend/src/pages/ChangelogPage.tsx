import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Newspaper, RefreshCw, Tag, Calendar, Sparkles, ExternalLink } from 'lucide-react';
import {
  fetchReleases,
  refreshReleases,
  fetchWhatsNew,
  refreshWhatsNew,
  type ReleaseEntry,
  type WhatsNewEntry,
} from '../api/changelog';
import { cn } from '../lib/utils';
import { queryKeys } from '../lib/queryKeys';

// ---------------------------------------------------------------------------
// Seen-state helpers (localStorage)
// ---------------------------------------------------------------------------

const LS_RELEASE = 'changelog_last_seen_version';
const LS_WHATSNEW = 'changelog_last_seen_week';

function getLastSeenVersion(): string {
  return localStorage.getItem(LS_RELEASE) ?? '';
}

function setLastSeenVersion(v: string) {
  localStorage.setItem(LS_RELEASE, v);
}

function getLastSeenWeek(): number {
  return parseInt(localStorage.getItem(LS_WHATSNEW) ?? '0', 10);
}

function setLastSeenWeek(n: number) {
  localStorage.setItem(LS_WHATSNEW, String(n));
}

function isNewerVersion(a: string, b: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const [am, amin, ap] = parse(a);
  const [bm, bmin, bp] = parse(b);
  if (am !== bm) return am > bm;
  if (amin !== bmin) return amin > bmin;
  return ap > bp;
}

// ---------------------------------------------------------------------------
// Inline code formatter for changelog item text
// ---------------------------------------------------------------------------

function FormattedItem({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <code
            key={i}
            style={{
              background: 'oklch(71% 0.185 192 / 0.12)',
              color: 'var(--accent)',
              padding: '1px 4px',
              borderRadius: 3,
              fontSize: '0.82em',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Release card
// ---------------------------------------------------------------------------

function ReleaseCard({
  entry,
  isNew,
  defaultOpen,
}: {
  entry: ReleaseEntry;
  isNew: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const addedItems = entry.items.filter((i) => i.toLowerCase().startsWith('added'));
  const improvedItems = entry.items.filter((i) => i.toLowerCase().startsWith('improved'));
  const fixedItems = entry.items.filter((i) => i.toLowerCase().startsWith('fixed'));
  const otherItems = entry.items.filter(
    (i) =>
      !i.toLowerCase().startsWith('added') &&
      !i.toLowerCase().startsWith('improved') &&
      !i.toLowerCase().startsWith('fixed')
  );

  return (
    <div
      className="card mb-3"
      style={{
        border: isNew ? '1px solid oklch(71% 0.185 192 / 0.35)' : undefined,
        background: isNew ? 'oklch(71% 0.185 192 / 0.04)' : undefined,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ borderBottom: open ? '1px solid var(--border)' : 'none' }}
      >
        <span
          className="text-sm font-mono font-semibold px-2 py-0.5 rounded"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
        >
          v{entry.version}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {entry.items.length} changes
        </span>
        {isNew && (
          <span
            className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success-border)' }}
          >
            NEW
          </span>
        )}
        {!isNew && (
          <span
            className="ml-auto text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {open ? '▲' : '▼'}
          </span>
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 py-3 space-y-3">
          {[
            { label: 'Added', items: addedItems, color: 'var(--success)' },
            { label: 'Improved', items: improvedItems, color: '#d29922' },
            { label: 'Fixed', items: fixedItems, color: '#79c0ff' },
            { label: 'Other', items: otherItems, color: 'var(--text-secondary)' },
          ]
            .filter((g) => g.items.length > 0)
            .map((group) => (
              <div key={group.label}>
                <div
                  className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                  style={{ color: group.color }}
                >
                  {group.label}
                </div>
                <ul className="space-y-1">
                  {group.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: group.color }} />
                      <FormattedItem text={item} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// What's New card
// ---------------------------------------------------------------------------

function WhatsNewCard({ entry, isNew }: { entry: WhatsNewEntry; isNew: boolean }) {
  const [open, setOpen] = useState(isNew);

  return (
    <div
      className="card mb-3"
      style={{
        border: isNew ? '1px solid oklch(71% 0.185 192 / 0.35)' : undefined,
        background: isNew ? 'oklch(71% 0.185 192 / 0.04)' : undefined,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
        style={{ borderBottom: open ? '1px solid var(--border)' : 'none' }}
      >
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-sm font-semibold px-2 py-0.5 rounded"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
            >
              {entry.label}
            </span>
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)', border: '1px solid var(--border)' }}
              >
                {tag}
              </span>
            ))}
            {isNew && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success-border)' }}
              >
                NEW
              </span>
            )}
          </div>
          {entry.date && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <Calendar size={11} />
              {entry.date}
            </div>
          )}
        </div>
        <span className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && entry.content && (
        <div
          className="px-4 py-3 text-sm whats-new-content"
          style={{ color: 'var(--text-secondary)' }}
          // Content comes from Anthropic's own docs page via our backend
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(entry.content) }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type Tab = 'releases' | 'whats-new';

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ChangelogPage() {
  const [tab, setTab] = useState<Tab>('releases');
  const qc = useQueryClient();

  // Seen state (initialised once on mount)
  const [lastSeenVersion, setLastSeenVersionState] = useState(getLastSeenVersion);
  const [lastSeenWeek, setLastSeenWeekState] = useState(getLastSeenWeek);

  // ---- Releases ----
  const {
    data: releases,
    isLoading: relLoading,
    error: relError,
  } = useQuery<ReleaseEntry[]>({
    queryKey: queryKeys.changelogReleases(),
    queryFn: fetchReleases,
    staleTime: _TTL_MS,
  });

  const refreshRelMut = useMutation({
    mutationFn: refreshReleases,
    onSuccess: (data) => qc.setQueryData(['changelog-releases'], data),
  });

  // ---- What's New ----
  const {
    data: whatsNew,
    isLoading: wnLoading,
    error: wnError,
  } = useQuery<WhatsNewEntry[]>({
    queryKey: queryKeys.changelogWhatsNew(),
    queryFn: fetchWhatsNew,
    staleTime: _TTL_MS,
  });

  const refreshWnMut = useMutation({
    mutationFn: refreshWhatsNew,
    onSuccess: (data) => qc.setQueryData(['changelog-whats-new'], data),
  });

  // Mark releases as seen when switching away from releases tab
  const markReleasesSeen = () => {
    if (releases && releases.length > 0) {
      const newest = releases[0].version;
      setLastSeenVersionState(newest);
      setLastSeenVersion(newest);
    }
  };

  const markWhatsNewSeen = () => {
    if (whatsNew && whatsNew.length > 0) {
      const highestWeek = Math.max(...whatsNew.map((e) => e.week));
      setLastSeenWeekState(highestWeek);
      setLastSeenWeek(highestWeek);
    }
  };

  const handleTabChange = (next: Tab) => {
    if (tab === 'releases') markReleasesSeen();
    if (tab === 'whats-new') markWhatsNewSeen();
    setTab(next);
  };

  // Mark seen on unmount
  useEffect(() => {
    return () => {
      markReleasesSeen();
      markWhatsNewSeen();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releases, whatsNew]);

  // Compute new counts
  const newReleaseCount = releases
    ? releases.filter(
        (r) => !lastSeenVersion || isNewerVersion(r.version, lastSeenVersion)
      ).length
    : 0;

  const newWnCount = whatsNew
    ? whatsNew.filter((e) => e.week > lastSeenWeek).length
    : 0;

  const isRefreshing =
    tab === 'releases' ? refreshRelMut.isPending : refreshWnMut.isPending;

  const handleRefresh = () => {
    if (tab === 'releases') refreshRelMut.mutate();
    else refreshWnMut.mutate();
  };

  return (
    <div className="p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Newspaper size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Claude Code Updates
        </h1>
        <a
          href="https://code.claude.com/docs/en/changelog"
          target="_blank"
          rel="noreferrer"
          className="ml-auto flex items-center gap-1 text-xs"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <ExternalLink size={11} />
          Docs
        </a>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-all hover:bg-white/5 disabled:opacity-50"
          style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {([
          { id: 'releases' as Tab, label: 'Releases', icon: Tag, count: newReleaseCount },
          { id: 'whats-new' as Tab, label: "What's New", icon: Sparkles, count: newWnCount },
        ] as const).map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all relative',
              tab === id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            <Icon size={14} />
            {label}
            {count > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: 'var(--success-dim)', color: 'var(--success)' }}
              >
                {count}
              </span>
            )}
            {tab === id && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'releases' && (
          <ReleasesTab
            releases={releases}
            isLoading={relLoading}
            error={relError}
            lastSeenVersion={lastSeenVersion}
          />
        )}
        {tab === 'whats-new' && (
          <WhatsNewTab
            entries={whatsNew}
            isLoading={wnLoading}
            error={wnError}
            lastSeenWeek={lastSeenWeek}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-panels
// ---------------------------------------------------------------------------

const _TTL_MS = 60 * 60 * 1000; // 1 hour stale time matches backend cache

function ReleasesTab({
  releases,
  isLoading,
  error,
  lastSeenVersion,
}: {
  releases?: ReleaseEntry[];
  isLoading: boolean;
  error: unknown;
  lastSeenVersion: string;
}) {
  if (isLoading) return <LoadingState label="Fetching changelog…" />;
  if (error || !releases) return <ErrorState />;
  if ((releases as any).error) return <ErrorState message={(releases as any).error} />;

  return (
    <div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        {releases.length} releases · sourced from{' '}
        <a
          href="https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          github.com/anthropics/claude-code
        </a>
      </p>
      {releases.map((r, idx) => (
        <ReleaseCard
          key={r.version}
          entry={r}
          isNew={!lastSeenVersion || isNewerVersion(r.version, lastSeenVersion)}
          defaultOpen={idx === 0}
        />
      ))}
    </div>
  );
}

function WhatsNewTab({
  entries,
  isLoading,
  error,
  lastSeenWeek,
}: {
  entries?: WhatsNewEntry[];
  isLoading: boolean;
  error: unknown;
  lastSeenWeek: number;
}) {
  if (isLoading) return <LoadingState label="Fetching what's new…" />;
  if (error || !entries) return <ErrorState />;
  if ((entries as any).error) return <ErrorState message={(entries as any).error} />;

  return (
    <div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        Weekly digest from{' '}
        <a
          href="https://code.claude.com/docs/en/whats-new"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          code.claude.com/docs/en/whats-new
        </a>
      </p>
      {entries.map((e) => (
        <WhatsNewCard key={e.id} entry={e} isNew={e.week > lastSeenWeek} />
      ))}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20 gap-3">
      <RefreshCw size={16} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </span>
    </div>
  );
}

function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-2">
      <span className="text-sm" style={{ color: 'var(--error)' }}>
        {message ?? 'Failed to load data. Check your connection and refresh.'}
      </span>
    </div>
  );
}
