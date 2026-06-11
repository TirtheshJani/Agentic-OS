import { useQuery } from '@tanstack/react-query';
import * as Tabs from '@radix-ui/react-tabs';
import { Settings, Package, Terminal, Wand2, Radio } from 'lucide-react';
import { SettingsEditor } from '../components/settings/SettingsEditor';
import { PluginList } from '../components/settings/PluginList';
import { CommandList } from '../components/settings/CommandList';
import { SkillList } from '../components/settings/SkillList';
import { fetchGatewayModels } from '../api/settings';
import { queryKeys } from '../lib/queryKeys';

function GatewayTab() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.gatewayModels(),
    queryFn: fetchGatewayModels,
    enabled: false,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-5">
      {data?.baseUrl && (
        <div className="card p-4">
          <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Base URL</div>
          <code className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{data.baseUrl}</code>
        </div>
      )}

      <button
        className="btn-primary text-sm px-3 py-1.5"
        onClick={() => refetch()}
        disabled={isFetching}
      >
        {isFetching ? 'Fetching…' : 'Fetch Available Models'}
      </button>

      {isLoading && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>}

      {error && (
        <div className="card p-4">
          <p className="text-sm" style={{ color: 'var(--error)' }}>{String(error)}</p>
        </div>
      )}

      {data?.error === 'API key not configured' && (
        <div
          className="card p-4 flex items-center gap-3"
          style={{ border: '1px solid rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.06)' }}
        >
          <p className="text-sm" style={{ color: '#fbbf24' }}>
            Set ANTHROPIC_API_KEY in your .env to use this feature.
          </p>
        </div>
      )}

      {data && data.models.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Model ID</th>
                <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Owner</th>
                <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.models.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{m.id}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.owned_by}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(m.created * 1000).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.models.length === 0 && !data.error && (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No models returned</p>
        </div>
      )}
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
      </div>

      <Tabs.Root defaultValue="settings">
        <Tabs.List
          className="flex gap-1 mb-6 p-1 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', width: 'fit-content', border: '1px solid var(--border)' }}
        >
          {[
            { value: 'settings', icon: Settings, label: 'Settings JSON' },
            { value: 'plugins',  icon: Package,  label: 'Plugins' },
            { value: 'commands', icon: Terminal, label: 'Commands' },
            { value: 'skills',   icon: Wand2,    label: 'Skills' },
            { value: 'gateway',  icon: Radio,    label: 'Gateway' },
          ].map(({ value, icon: Icon, label }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all"
              style={{
                color: 'var(--text-secondary)',
              }}
            >
              <Icon size={13} />
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="settings">
          <SettingsEditor />
        </Tabs.Content>
        <Tabs.Content value="plugins">
          <PluginList />
        </Tabs.Content>
        <Tabs.Content value="commands">
          <CommandList />
        </Tabs.Content>
        <Tabs.Content value="skills">
          <SkillList />
        </Tabs.Content>
        <Tabs.Content value="gateway">
          <GatewayTab />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
