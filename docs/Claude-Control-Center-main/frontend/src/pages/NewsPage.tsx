import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Newspaper, RefreshCw, AtSign, MessageCircle, Rss, Sparkles, Download,
  Lightbulb, GraduationCap, ExternalLink, AlertTriangle,
} from 'lucide-react';
import {
  useNewsFeed, useNewsIdeas, useNewsSources,
  useRefreshNews, useGenerateIdeas, useExportIdea,
} from '../hooks/useNews';
import { fetchVaults } from '../api/obsidian';
import { queryKeys } from '../lib/queryKeys';
import { relativeTime } from '../lib/utils';
import { cn } from '../lib/utils';
import type { NewsItem, NewsSource, VideoIdea, LearningIdea } from '../api/news';

const SOURCE_META: Record<NewsSource, { label: string; icon: typeof AtSign; color: string }> = {
  x: { label: 'X / @ClaudeDevs', icon: AtSign, color: '#60a5fa' },
  news: { label: 'Tech News', icon: Rss, color: '#fb923c' },
  reddit: { label: 'Reddit', icon: MessageCircle, color: '#f87171' },
};

const FILTERS: Array<{ key: NewsSource | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'x', label: 'X' },
  { key: 'news', label: 'News' },
  { key: 'reddit', label: 'Reddit' },
];

// Feed URLs come from untrusted RSS/Reddit/X content — only allow http(s).
function isSafeHttpUrl(u: string): boolean {
  try {
    const p = new URL(u, window.location.origin);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}

function FeedCard({ item }: { item: NewsItem }) {
  const meta = SOURCE_META[item.source];
  const Icon = meta.icon;
  const safe = isSafeHttpUrl(item.url);
  const Wrapper = safe ? 'a' : 'div';
  return (
    <Wrapper
      {...(safe ? { href: item.url, target: '_blank', rel: 'noreferrer' } : {})}
      className="card block hover:border-[var(--border-strong)] transition-colors"
      style={{ padding: 14 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} style={{ color: meta.color, flexShrink: 0 }} />
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.author || meta.label}</span>
        {item.timestamp && (
          <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
            {relativeTime(item.timestamp)}
          </span>
        )}
        {typeof item.score === 'number' && (
          <span className="chip text-xs" style={{ background: 'rgba(255,255,255,0.06)' }}>▲ {item.score}</span>
        )}
      </div>
      <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{item.title}</div>
      {item.summary && (
        <p className="text-xs line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{item.summary}</p>
      )}
    </Wrapper>
  );
}

function IdeaCard({
  idea, onExport, exporting,
}: {
  idea: VideoIdea | LearningIdea;
  onExport: (idea: VideoIdea | LearningIdea) => void;
  exporting: boolean;
}) {
  const isVideo = idea.kind === 'video';
  const Icon = isVideo ? Lightbulb : GraduationCap;
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="flex items-start gap-2 mb-2">
        <Icon size={14} style={{ color: isVideo ? '#fbbf24' : '#4ade80', flexShrink: 0, marginTop: 2 }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{idea.title}</span>
      </div>
      <div className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
        {isVideo ? (
          <>
            {(idea as VideoIdea).hook && <p><b>Hook:</b> {(idea as VideoIdea).hook}</p>}
            {(idea as VideoIdea).audience && <p><b>Audience:</b> {(idea as VideoIdea).audience}</p>}
            {(idea as VideoIdea).why_now && <p><b>Why now:</b> {(idea as VideoIdea).why_now}</p>}
          </>
        ) : (
          <>
            {(idea as LearningIdea).format && <p><b>Format:</b> {(idea as LearningIdea).format}</p>}
            {(idea as LearningIdea).level && <p><b>Level:</b> {(idea as LearningIdea).level}</p>}
            {(idea as LearningIdea).outline && <p><b>Outline:</b> {(idea as LearningIdea).outline}</p>}
          </>
        )}
      </div>
      <button
        className="chip text-xs mt-3 flex items-center gap-1"
        onClick={() => onExport(idea)}
        disabled={exporting}
        style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}
      >
        <Download size={11} /> {exporting ? 'Exporting…' : 'Export to vault'}
      </button>
    </div>
  );
}

export function NewsPage() {
  const [filter, setFilter] = useState<NewsSource | 'all'>('all');
  const [vaultId, setVaultId] = useState<string>('');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: feed, isLoading } = useNewsFeed();
  const { data: ideas } = useNewsIdeas();
  const { data: sources } = useNewsSources();
  const { data: vaults } = useQuery({ queryKey: queryKeys.obsidianVaults(), queryFn: fetchVaults });

  const refresh = useRefreshNews();
  const generate = useGenerateIdeas();
  const exportIdea = useExportIdea();

  const items = feed?.items ?? [];
  const filtered = filter === 'all' ? items : items.filter((i) => i.source === filter);

  const unconfigured = sources
    ? (['x', 'news', 'reddit', 'ideas'] as const).filter((k) => !sources[k]?.configured)
    : [];

  const handleExport = async (idea: VideoIdea | LearningIdea) => {
    if (!vaultId) {
      setNotice('Pick a vault first.');
      return;
    }
    setExportingId(idea.id);
    setNotice(null);
    try {
      const res = await exportIdea.mutateAsync({ vaultId, idea });
      setNotice(`Saved to ${res.note.path}`);
    } catch {
      setNotice('Export failed.');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Newspaper size={22} style={{ color: 'var(--accent)' }} />
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>News &amp; Information</h1>
        <button
          className="btn-primary ml-auto flex items-center gap-2"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
        >
          <RefreshCw size={14} className={cn(refresh.isPending && 'animate-spin')} />
          {refresh.isPending ? 'Refreshing…' : 'Refresh feed'}
        </button>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        {feed?.refreshed_at
          ? `Last refreshed ${relativeTime(feed.refreshed_at)}`
          : 'Not refreshed yet — click Refresh to pull the latest.'}
      </p>

      {/* Unconfigured banner */}
      {unconfigured.length > 0 && (
        <div className="card flex items-center gap-2 mb-4" style={{ padding: 10, background: 'rgba(251,191,36,0.08)' }}>
          <AlertTriangle size={14} style={{ color: '#fbbf24', flexShrink: 0 }} />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Not configured: {unconfigured.join(', ')}. These streams will be empty until their API keys are set in the backend <code>.env</code>.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feed (2 cols) */}
        <div className="lg:col-span-2">
          <div className="flex gap-2 mb-3">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn('chip text-xs', filter === f.key && 'ring-1')}
                style={filter === f.key
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="card text-center text-sm" style={{ padding: 32, color: 'var(--text-tertiary)' }}>
              No items yet. Click <b>Refresh feed</b> to pull from X, tech news and Reddit.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((item) => <FeedCard key={item.id} item={item} />)}
            </div>
          )}
        </div>

        {/* Ideas sidebar */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} style={{ color: '#a78bfa' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Content Ideas</h2>
            <button
              className="chip text-xs ml-auto"
              onClick={() => generate.mutate(['video', 'learning'])}
              disabled={generate.isPending || items.length === 0}
              style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}
            >
              {generate.isPending ? 'Generating…' : 'Generate'}
            </button>
          </div>

          {/* Vault picker */}
          <select
            className="input-field w-full mb-2 text-xs"
            value={vaultId}
            onChange={(e) => setVaultId(e.target.value)}
          >
            <option value="">Export target vault…</option>
            {vaults?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          {notice && <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{notice}</p>}

          {generate.isError && (
            <p className="text-xs mb-2" style={{ color: '#f87171' }}>
              Generation failed — ensure the feed is refreshed and ANTHROPIC_API_KEY is set.
            </p>
          )}

          <div className="space-y-3">
            {[...(ideas?.video ?? []), ...(ideas?.learning ?? [])].length === 0 ? (
              <div className="card text-center text-xs" style={{ padding: 24, color: 'var(--text-tertiary)' }}>
                No ideas yet. Refresh the feed, then click <b>Generate</b>.
              </div>
            ) : (
              [...(ideas?.video ?? []), ...(ideas?.learning ?? [])].map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onExport={handleExport}
                  exporting={exportingId === idea.id}
                />
              ))
            )}
          </div>

          {ideas?.generated_at && (
            <p className="text-xs mt-3 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
              <ExternalLink size={10} /> Generated {relativeTime(ideas.generated_at)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
