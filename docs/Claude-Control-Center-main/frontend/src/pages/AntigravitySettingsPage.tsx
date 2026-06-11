import { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import { useAntigravitySettings, useUpdateAntigravitySettings } from '../hooks/useAntigravity';

export function AntigravitySettingsPage() {
  const { data: settings, isLoading } = useAntigravitySettings();
  const { mutate: updateSettings, isPending } = useUpdateAntigravitySettings();
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setJsonText(JSON.stringify(settings, null, 2));
    }
  }, [settings]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setError(null);
      updateSettings(parsed);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="p-6 flex flex-col h-full gap-5">
      <div className="flex items-center gap-3">
        <Settings size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Antigravity Settings</h1>
      </div>

      <div className="card p-4 flex-1 flex flex-col min-h-0">
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Edit the raw JSON configuration for Antigravity CLI.
        </p>

        {isLoading ? (
          <div className="skeleton flex-1 rounded-md" />
        ) : (
          <div className="flex-1 flex flex-col min-h-0 gap-3">
            <textarea
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setError(null);
              }}
              className="flex-1 p-4 font-mono text-sm rounded-md bg-black/20"
              style={{
                border: error ? '1px solid var(--error)' : '1px solid var(--border)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
            {error && <span className="text-xs" style={{ color: 'var(--error)' }}>Invalid JSON: {error}</span>}
            
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={isPending || !!error}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
              >
                <Save size={14} />
                {isPending ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
