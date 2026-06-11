import * as Switch from '@radix-ui/react-switch';
import { usePlugins, useTogglePlugin } from '../../hooks/useSettings';
import { relativeTime } from '../../lib/utils';
import { Package } from 'lucide-react';

export function PluginList() {
  const { data: plugins, isLoading } = usePlugins();
  const toggleMutation = useTogglePlugin();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-center justify-between">
            <div className="space-y-2">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-3 w-24" />
            </div>
            <div className="skeleton h-6 w-10 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!plugins?.length) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No plugins installed</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plugins.map((plugin) => (
        <div key={plugin.id} className="card p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
              style={{ background: 'var(--accent-dim)' }}>
              <Package size={14} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {plugin.name}
                </span>
                <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}>
                  {plugin.version}
                </span>
                <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)' }}>
                  {plugin.scope}
                </span>
                {plugin.estimatedContextTokens != null && (
                  <span className="chip" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                    ~{plugin.estimatedContextTokens >= 1000
                      ? Math.round(plugin.estimatedContextTokens / 1000) + 'k'
                      : plugin.estimatedContextTokens} ctx tokens
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {plugin.marketplace} · installed {relativeTime(plugin.installedAt)}
              </p>
            </div>
          </div>

          <Switch.Root
            checked={plugin.isEnabled}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ pluginId: plugin.id, enabled: checked })
            }
            className="flex-shrink-0"
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              background: plugin.isEnabled ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.15s',
            }}
          >
            <Switch.Thumb
              style={{
                display: 'block',
                width: 14,
                height: 14,
                borderRadius: 7,
                background: 'white',
                position: 'absolute',
                top: 3,
                left: plugin.isEnabled ? 19 : 3,
                transition: 'left 0.15s',
              }}
            />
          </Switch.Root>
        </div>
      ))}
    </div>
  );
}
