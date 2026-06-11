import { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { Check, AlertCircle } from 'lucide-react';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';

export function SettingsEditor() {
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();
  const [value, setValue] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setValue(JSON.stringify(settings, null, 2));
    }
  }, [settings]);

  async function handleSave() {
    try {
      const parsed = JSON.parse(value);
      await updateMutation.mutateAsync(parsed);
      setToast({ type: 'success', message: 'Settings saved!' });
    } catch (e) {
      setToast({ type: 'error', message: e instanceof Error ? e.message : 'Failed to save' });
    }
    setTimeout(() => setToast(null), 3000);
  }

  if (isLoading) {
    return <div className="p-4"><div className="skeleton h-64 rounded-lg" /></div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', height: 400 }}>
        <CodeMirror
          value={value}
          onChange={setValue}
          extensions={[json()]}
          theme={oneDark}
          height="400px"
          basicSetup={{ lineNumbers: true, foldGutter: true }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="btn-primary"
        >
          {updateMutation.isPending ? 'Saving…' : 'Save Settings'}
        </button>

        {toast && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm animate-fade-in"
            style={{
              background: toast.type === 'success' ? 'var(--success-dim)' : 'oklch(62% 0.22 25 / 0.12)',
              color: toast.type === 'success' ? 'var(--success)' : 'var(--error)',
              border: `1px solid ${toast.type === 'success' ? 'var(--success-border)' : 'oklch(62% 0.22 25 / 0.20)'}`,
            }}
          >
            {toast.type === 'success' ? <Check size={13} /> : <AlertCircle size={13} />}
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
