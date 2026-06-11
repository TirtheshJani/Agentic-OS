import { useState } from 'react';
import { Wrench, Trash2, Plus } from 'lucide-react';
import { useAntigravitySkills, useAddAntigravitySkill, useDeleteAntigravitySkill } from '../hooks/useAntigravity';

export function AntigravitySkillsPage() {
  const { data, isLoading } = useAntigravitySkills();
  const { mutate: addSkill, isPending: isAdding } = useAddAntigravitySkill();
  const { mutate: deleteSkill } = useDeleteAntigravitySkill();

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');

  const handleAdd = () => {
    if (!newName || !newContent) return;
    addSkill({ name: newName, content: newContent }, {
      onSuccess: () => {
        setIsAddingNew(false);
        setNewName('');
        setNewContent('');
      }
    });
  };

  return (
    <div className="p-6 flex flex-col h-full gap-5">
      <div className="flex items-center gap-3">
        <Wrench size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Antigravity Extensions & Skills</h1>
        <button
          onClick={() => setIsAddingNew(true)}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90"
        >
          <Plus size={14} /> Add Skill
        </button>
      </div>

      {isAddingNew && (
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Add New Skill</h2>
          <input
            type="text"
            placeholder="Skill filename (e.g. format_code.sh)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md bg-transparent"
            style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <textarea
            placeholder="Skill script content..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 text-sm font-mono rounded-md bg-transparent"
            style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={isAdding || !newName || !newContent}
              className="px-4 py-1.5 rounded text-xs bg-[var(--accent)] text-white disabled:opacity-50"
            >
              {isAdding ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setIsAddingNew(false)}
              className="px-4 py-1.5 rounded text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="grid gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider flex-shrink-0" style={{ gridTemplateColumns: 'minmax(0,2fr) 80px 100px 150px 40px', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
          <span>Skill</span><span>Exec</span><span>Size</span><span>Modified</span><span />
        </div>

        {isLoading ? (
          <div className="p-6 flex justify-center"><div className="skeleton h-8 w-32" /></div>
        ) : !data?.items.length ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No skills found.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {data.items.map((skill) => (
              <div
                key={skill.name}
                className="grid gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors items-center"
                style={{ gridTemplateColumns: 'minmax(0,2fr) 80px 100px 150px 40px', borderBottom: '1px solid var(--border)' }}
              >
                <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{skill.name}</span>
                <span className="text-xs" style={{ color: skill.executable ? 'var(--success)' : 'var(--text-tertiary)' }}>
                  {skill.executable ? 'Yes' : 'No'}
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{Math.round(skill.size / 1024)} KB</span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(skill.modified * 1000).toLocaleString()}</span>
                <button
                  onClick={() => deleteSkill(skill.name)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-red-500/70 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
