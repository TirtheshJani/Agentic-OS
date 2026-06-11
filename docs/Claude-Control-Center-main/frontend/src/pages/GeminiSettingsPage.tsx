import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { SlidersHorizontal, ShieldCheck, ShieldOff } from 'lucide-react';
import { fetchGeminiSettings, updateGeminiSettings } from '../api/gemini';

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
      {title}
    </div>
  );
}

function ConfigSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.geminiSettings(),
    queryFn: fetchGeminiSettings,
    staleTime: 60_000,
  });

  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: ({ path, trust_level }: { path: string; trust_level: string }) =>
      updateGeminiSettings(path, trust_level),
    onSuccess: (_, vars) => {
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[vars.path];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.geminiSettings() });
    },
  });

  const projects = data?.projects ?? [];

  return (
    <div className="card px-4 py-3">
      <SectionHeader title="Project Trust Configuration" />
      {isLoading && <div className="skeleton h-24 rounded" />}
      {!isLoading && projects.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No project entries in Gemini config.</p>
      )}
      {projects.length > 0 && (
        <div className="space-y-2">
          {projects.map((p) => {
            const current = pendingChanges[p.path] ?? p.trust_level;
            const changed = current !== p.trust_level;
            return (
              <div key={p.path} className="flex items-center gap-3 py-2 px-3 rounded-md" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                {current === 'trusted'
                  ? <ShieldCheck size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  : <ShieldOff size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />}
                <span className="flex-1 text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }} title={p.path}>{p.path}</span>
                <select
                  value={current}
                  onChange={(e) => setPendingChanges((prev) => ({ ...prev, [p.path]: e.target.value }))}
                  className="text-xs rounded px-2 py-1"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', outline: 'none' }}
                >
                  <option value="trusted">trusted</option>
                  <option value="untrusted">untrusted</option>
                </select>
                {changed && (
                  <button
                    onClick={() => save({ path: p.path, trust_level: current })}
                    disabled={saving}
                    className="text-xs px-2 py-1 rounded-md transition-all hover:opacity-80 disabled:opacity-40"
                    style={{ background: 'var(--accent)', color: '#000', fontWeight: 600 }}
                  >
                    Save
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GeminiSettingsPage() {
  return (
    <div className="p-6 flex flex-col h-full gap-5 overflow-auto">
      <div className="flex items-center gap-3">
        <SlidersHorizontal size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Gemini Settings</h1>
      </div>
      <ConfigSection />
    </div>
  );
}
