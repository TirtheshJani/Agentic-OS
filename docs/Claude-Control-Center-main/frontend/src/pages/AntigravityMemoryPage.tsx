import { Sparkles, FileText, File } from 'lucide-react';
import { useAntigravityMemory } from '../hooks/useAntigravity';

export function AntigravityMemoryPage() {
  const { data, isLoading } = useAntigravityMemory();

  return (
    <div className="p-6 flex flex-col h-full gap-5">
      <div className="flex items-center gap-3">
        <Sparkles size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Antigravity Memory</h1>
      </div>
      
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Memory files stored in the <code>knowledge/</code> directory.
      </p>

      <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="grid gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider flex-shrink-0" style={{ gridTemplateColumns: 'minmax(0,2fr) 100px 150px', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
          <span>File</span><span>Size</span><span>Modified</span>
        </div>

        {isLoading ? (
          <div className="p-6 flex justify-center"><div className="skeleton h-8 w-32" /></div>
        ) : !data?.items.length ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No memory files found.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {data.items.map((file) => (
              <div
                key={file.path}
                className="grid gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                style={{ gridTemplateColumns: 'minmax(0,2fr) 100px 150px', borderBottom: '1px solid var(--border)' }}
              >
                <span className="text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <FileText size={14} style={{ color: 'var(--text-tertiary)' }} />
                  {file.filename}
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {Math.round(file.size / 1024)} KB
                </span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {new Date(file.modified * 1000).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
