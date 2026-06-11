import { useNavigate } from 'react-router-dom';
import { Sparkles, Terminal, Puzzle, SlidersHorizontal, Database, BarChart2 } from 'lucide-react';

const SECTIONS = [
  { icon: Terminal, label: 'Sessions', description: 'Browse and search Gemini CLI sessions', path: '/gemini-sessions' },
  { icon: Puzzle, label: 'Skills', description: 'Installed Gemini skills and agents', path: '/gemini-skills' },
  { icon: SlidersHorizontal, label: 'Settings', description: 'Auth, models, and project config', path: '/gemini-settings' },
  { icon: Database, label: 'Memory', description: 'Query history and session index', path: '/gemini-memory' },
  { icon: BarChart2, label: 'Analytics', description: 'Usage trends and tool statistics', path: '/gemini-analytics' },
];

export function GeminiPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-8">
        <Sparkles size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Gemini CLI</h1>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map(({ icon: Icon, label, description, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="card text-left px-5 py-4 flex items-start gap-4 hover:bg-white/[0.04] transition-colors"
            style={{ border: '1px solid var(--border)' }}
          >
            <div
              className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-dim)' }}
            >
              <Icon size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{label}</div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
